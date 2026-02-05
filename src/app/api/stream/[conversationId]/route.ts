/**
 * Stream API 路由
 * 
 * 用于前端获取 Agent 任务的流式输出
 * 支持：初始状态获取、实时流式推送、重连恢复
 */

import { NextRequest } from 'next/server';
import { conversationBuffer } from '@/lib/buffer';
import * as db from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5分钟超时

/**
 * GET /api/stream/[conversationId]
 * 
 * 建立 HTTP Stream 连接，返回 Agent 任务的流式输出
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const searchParams = request.nextUrl.searchParams;
  
  // 可选参数：从指定位置开始读取（用于重连）
  const fromIndexParam = searchParams.get('fromIndex');
  const fromIndex = fromIndexParam ? parseInt(fromIndexParam, 10) : -1;

  console.log(`[Stream API] Connection request for conversation ${conversationId}`);

  // 检查是否有正在运行的任务
  const task = conversationBuffer.getTask(conversationId);

  if (!task) {
    // 没有运行中的任务，从数据库加载历史消息
    console.log(`[Stream API] No active task, loading from DB for ${conversationId}`);
    
    const messages = db.getMessagesByConversation(conversationId);
    
    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found or no messages' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 将历史消息拼接成 stream 格式
    const streamMessages = messages
      .map((msg) => {
        if (msg.role === 'system') {
          return `[SYSTEM]${msg.content}[/SYSTEM]`;
        } else if (msg.role === 'user') {
          return `[USER]${msg.content}[/USER]`;
        } else if (msg.role === 'assistant') {
          // 检查是否有 tool calls
          if (msg.metadata?.tool_calls) {
            const toolCalls = msg.metadata.tool_calls
              .map((tc: any) => `[TOOL]${tc.name}:${JSON.stringify(tc.parameters)}[/TOOL]`)
              .join('');
            return `[ASSISTANT]${msg.content || ''}[/ASSISTANT]${toolCalls}[MESSAGE_FINISHED]`;
          }
          return `[ASSISTANT]${msg.content}[/ASSISTANT][MESSAGE_FINISHED]`;
        }
        return '';
      })
      .join('') + '[AGENT_FINISHED]';

    // 返回一次性响应（历史记录直接渲染）
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // 发送初始化状态
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'init',
              streamMessages,
              lastMessageIndex: streamMessages.length - '[AGENT_FINISHED]'.length,
              lastStreamOutputIndex: -1,
              status: 'completed',
            })}\n\n`
          )
        );

        // 发送完成标记
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'agent_finished' })}\n\n`)
        );

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  // 有正在运行的任务，建立流式连接
  console.log(`[Stream API] Active task found, establishing stream for ${conversationId}`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 获取当前状态
      const state = conversationBuffer.getFullState(conversationId);
      if (!state) {
        controller.error(new Error('Task not found'));
        return;
      }

      // 发送初始化状态
      const startIndex = fromIndex >= 0 ? fromIndex : state.lastStreamOutputIndex;
      
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: 'init',
            streamMessages: state.streamMessages,
            lastMessageIndex: state.lastMessageIndex,
            lastStreamOutputIndex: startIndex,
            status: state.status,
          })}\n\n`
        )
      );

      // 如果有堆积的数据，立即发送
      if (startIndex < state.streamMessages.length) {
        const pendingData = state.streamMessages.slice(startIndex + 1);
        
        // 分批发送堆积的数据
        const chunkSize = 1000; // 每批最多1000个字符
        for (let i = 0; i < pendingData.length; i += chunkSize) {
          const chunk = pendingData.slice(i, i + chunkSize);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`
            )
          );
        }
      }

      // 订阅后续更新
      const unsubscribe = conversationBuffer.subscribe(conversationId, (event) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );

          // 如果任务完成或出错，关闭连接
          if (event.type === 'agent_finished' || event.type === 'agent_error') {
            setTimeout(() => {
              try {
                controller.close();
              } catch (e) {
                // 可能已经被关闭
              }
            }, 100);
          }
        } catch (error) {
          // 写入失败，取消订阅
          unsubscribe();
        }
      });

      // 处理连接关闭
      request.signal.addEventListener('abort', () => {
        console.log(`[Stream API] Connection aborted for ${conversationId}`);
        unsubscribe();
      });
    },

    cancel() {
      console.log(`[Stream API] Stream cancelled for ${conversationId}`);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * POST /api/stream/[conversationId]/stop
 * 
 * 停止正在运行的 Agent 任务
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;

  console.log(`[Stream API] Stop request for conversation ${conversationId}`);

  const task = conversationBuffer.getTask(conversationId);
  
  if (!task) {
    return Response.json(
      { error: 'No active task found' },
      { status: 404 }
    );
  }

  if (task.status !== 'running') {
    return Response.json(
      { error: `Task is already ${task.status}` },
      { status: 400 }
    );
  }

  conversationBuffer.stopTask(conversationId);

  return Response.json({ success: true, message: 'Task stopped' });
}
