import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { tool, ToolLoopAgent, createAgentUIStreamResponse, stepCountIs } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { conversationBuffer } from '@/lib/buffer';
import fs from 'fs';
import path from 'path';

export const maxDuration = 300; // 5分钟超时

// ==================== System Prompts ====================

const BASE_SYSTEM_PROMPT = `你是 DeepQeeb 的智能辅助。你的目标是协助用户完成文字游戏剧本创作或游戏生成。

你拥有一系列【技能(Skills)】，这些技能定义了你的专业职责和工作标准。
在开始工作前，请务必先使用 'read_skills' 工具列出并阅读相关技能内容。

## 核心原则：
1. **文件驱动**：所有创作内容必须体现在剧本项目的文件系统中。
2. **提议模式**：当你修改已有文件时，请使用 'propose_file_edit' 提交更改，用户将审核 Diff。
3. **技能导向**：根据当前的 agent_mode (script/game)，读取并严格遵守对应的技能文档。
4. **即时反馈**：在执行文件操作时，请在对话中简要解释你做了什么或接下来需要用户做什么。不要保持沉默。

当前模式：{{agent_mode}}
`;

const PROMPT_MAP: Record<string, string> = {
  script: '你当前担任【剧本编剧】角色。请阅读 "script-writer" 技能并遵照其标准工作。',
  game: '你当前担任【游戏导演】角色。请阅读 "game-developer" 技能并遵照其标准工作。'
};

export async function POST(req: Request) {
  try {
    const { messages, conversation_id, script_id, agent_mode } = await req.json();

    console.log('--- Chat Request ---');
    console.log('conversation_id:', conversation_id);
    console.log('script_id:', script_id);
    console.log('agent_mode:', agent_mode);

    if (!script_id) {
      return NextResponse.json({ error: 'Missing script_id' }, { status: 400 });
    }

    if (!conversation_id) {
      return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
    }

    // 检查是否已有正在运行的任务
    const existingTask = conversationBuffer.getTask(conversation_id);
    if (existingTask && existingTask.status === 'running') {
      return NextResponse.json(
        { error: 'A task is already running for this conversation' },
        { status: 409 }
      );
    }

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
    });

    // 构建初始消息字符串
    const lastMessage = messages[messages.length - 1];
    const initialMessages = buildInitialMessages(messages);

    // 创建 Agent 任务到 Buffer
    conversationBuffer.createTask(
      conversation_id,
      script_id,
      agent_mode || 'script',
      initialMessages
    );

    // 保存用户消息到数据库
    if (lastMessage && lastMessage.role === 'user') {
      db.createMessage(conversation_id, 'user', lastMessage.content);
    }

    // 更新对话模式
    db.updateConversationMode(conversation_id, agent_mode || 'script');

    // 启动 Agent 任务（后台运行，不阻塞响应）
    runAgentTask({
      conversationId: conversation_id,
      scriptId: script_id,
      agentMode: agent_mode || 'script',
      messages,
      openrouter,
    });

    // 立即返回成功响应，前端将通过 Stream API 获取输出
    return NextResponse.json({
      success: true,
      message: 'Agent task started',
      conversationId: conversation_id,
      streamUrl: `/api/stream/${conversation_id}`,
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * 构建初始消息字符串（用于 Buffer）
 */
function buildInitialMessages(messages: any[]): string {
  return messages
    .map((msg) => {
      if (msg.role === 'system') {
        return `[SYSTEM]${msg.content}[/SYSTEM]`;
      } else if (msg.role === 'user') {
        return `[USER]${msg.content}[/USER]`;
      } else if (msg.role === 'assistant') {
        if (msg.tool_calls) {
          const toolCalls = msg.tool_calls
            .map((tc: any) => `[TOOL]${tc.name}:${JSON.stringify(tc.parameters)}[/TOOL]`)
            .join('');
          return `[ASSISTANT]${msg.content || ''}[/ASSISTANT]${toolCalls}[MESSAGE_FINISHED]`;
        }
        return `[ASSISTANT]${msg.content}[/ASSISTANT][MESSAGE_FINISHED]`;
      }
      return '';
    })
    .join('');
}

/**
 * 后台运行 Agent 任务
 */
async function runAgentTask({
  conversationId,
  scriptId,
  agentMode,
  messages,
  openrouter,
}: {
  conversationId: string;
  scriptId: string;
  agentMode: 'script' | 'game';
  messages: any[];
  openrouter: any;
}) {
  console.log(`[Agent Task] Starting for conversation ${conversationId}`);

  try {
    // 2. Define Agent
    const agent = new ToolLoopAgent({
      model: openrouter(process.env.DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet'),
      instructions: BASE_SYSTEM_PROMPT.replace('{{agent_mode}}', agentMode) + '\n' + (PROMPT_MAP[agentMode] || ''),
      tools: {
        list_files: tool({
          description: '列出当前剧本项目的代码和文件夹。',
          parameters: z.object({
            directory: z.string().optional().describe('要列出的目录。默认为根目录 "/"')
          }),
          // @ts-ignore
          execute: async ({ directory = '/' }: { directory?: string }) => {
            const files = db.getFilesByScript(scriptId, true);

            if (files.length === 0) return 'No files found in this script.';

            const cleanDir = directory.endsWith('/') ? directory : directory + '/';
            const filtered = files.filter(f => {
              if (directory === '/') {
                const relative = f.path.startsWith('/') ? f.path.substring(1) : f.path;
                return !relative.includes('/');
              }
              if (!f.path.startsWith(cleanDir)) return false;
              const relative = f.path.substring(cleanDir.length);
              return !relative.includes('/') && relative.length > 0;
            });

            return filtered.map(f => `[${f.type.toUpperCase()}] ${f.path}`).join('\n');
          },
        }),
        read_file: tool({
          description: '读取剧本项目中特定文件的内容。',
          parameters: z.object({
            path: z.string().describe('文件绝对路径，例如 "/剧本/01-故事线.md"')
          }),
          // @ts-ignore
          execute: async ({ path }: { path: string }) => {
            const file = db.getFileByPath(scriptId, path);
            if (!file) return `Error reading file: File not found`;
            return file.content || '(空文件)';
          },
        }),
        propose_file_edit: tool({
          description: '对已有文件提议修改。这将向用户展示 Diff，用户可选择接受或拒绝。',
          parameters: z.object({
            path: z.string().describe('要修改的文件路径。'),
            new_content: z.string().describe('文件的新完整内容。')
          }),
          // @ts-ignore
          execute: async ({ path, new_content }: { path: string, new_content: string }) => {
            try {
              db.updateFilePendingContent(scriptId, path, new_content);
              return `已提交对 ${path} 的修改建议。用户将在界面上看到差异对比并决定是否应用。`;
            } catch (e: any) {
              return `Error proposing edit: ${e.message}`;
            }
          },
        }),
        create_file: tool({
          description: '在剧本项目中创建一个新文件（目前仅限 .md 或代码文件）。',
          parameters: z.object({
            path: z.string().describe('绝对路径，例如 "/剧本/新人物.md"'),
            content: z.string().optional().describe('文件的初始内容。')
          }),
          // @ts-ignore
          execute: async ({ path, content = '' }: { path: string, content?: string }) => {
            try {
              const name = path.split('/').pop() || 'file';
              db.createFile(scriptId, path, name, 'file', content, true);
              return `成功创建文件: ${path}`;
            } catch (e: any) {
              return `Error creating file: ${e.message}`;
            }
          },
        }),
        create_folder: tool({
          description: '在剧本项目中创建一个新文件夹。',
          parameters: z.object({
            path: z.string().describe('绝对路径，例如 "/剧本/场景"')
          }),
          // @ts-ignore
          execute: async ({ path }: { path: string }) => {
            try {
              const name = path.split('/').pop() || 'folder';
              db.createFile(scriptId, path, name, 'folder', undefined, true);
              return `成功创建文件夹: ${path}`;
            } catch (e: any) {
              return `Error creating folder: ${e.message}`;
            }
          },
        }),
        read_skills: tool({
          description: '从知识库读取可用技能。当你不知道该做什么或怎么做时，请先阅读此项。',
          parameters: z.object({
            skill_name: z.string().optional().describe('技能名称（英文，如 "script-writer"）。如果省略，则列出所有技能及其描述。')
          }),
          // @ts-ignore
          execute: async ({ skill_name }: { skill_name?: string }) => {
            try {
              const skillsDir = path.join(process.cwd(), 'skills');

              if (!fs.existsSync(skillsDir)) return '技能目录不存在。';

              if (skill_name) {
                const filePath = path.join(skillsDir, `${skill_name}.md`);
                if (fs.existsSync(filePath)) {
                  return fs.readFileSync(filePath, 'utf8');
                }
                return `未找到技能 "${skill_name}"。你可以尝试列出所有技能查看可用项。`;
              } else {
                const files = fs.readdirSync(skillsDir).filter((f: string) => f.endsWith('.md'));
                const summaries = files.map((f: string) => {
                  const content = fs.readFileSync(path.join(skillsDir, f), 'utf8');
                  const match = content.match(/^---\n([\s\S]*?)\n---/);
                  const metadata = match ? match[1] : 'No metadata found';
                  return `文件名: ${f.replace('.md', '')}\n元数据:\n${metadata}\n---`;
                });
                return `可用技能列表及说明：\n\n${summaries.join('\n\n')}`;
              }
            } catch (e: any) {
              return `读取技能失败: ${e.message}`;
            }
          },
        }),
        search_files: tool({
          description: '在剧本项目中通过名称或内容搜索文件。',
          parameters: z.object({
            query: z.string().describe('搜索关键词')
          }),
          // @ts-ignore
          execute: async ({ query }: { query: string }) => {
            try {
              const results = db.searchFiles(scriptId, query);
              if (results.length === 0) return '未找到匹配的文件。';
              return results.map(f => `[${f.type.toUpperCase()}] ${f.path}`).join('\n');
            } catch (e: any) {
              return `Error searching files: ${e.message}`;
            }
          },
        })
      },
      stopWhen: stepCountIs(20),
    });

    // 创建流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await createAgentUIStreamResponse({
            agent,
            uiMessages: messages,
          });

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('Failed to get reader from response');
          }

          const decoder = new TextDecoder();
          let currentText = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            currentText += chunk;

          // 将 chunk 写入 Buffer
          conversationBuffer.writeChunk(conversationId, chunk);
          }

          // 标记消息完成
          conversationBuffer.markMessageFinished(conversationId);

          // 标记 Agent 完成
          conversationBuffer.markAgentFinished(conversationId);

          // 保存最终消息到数据库
          if (currentText) {
            db.createMessage(conversationId, 'assistant', currentText, {
              type: 'normal',
              agent_mode: agentMode,
            });
          }

          controller.close();
        } catch (error) {
          console.error('[Agent Task] Error:', error);
          conversationBuffer.markAgentError(
            conversationId,
            error instanceof Error ? error.message : 'Unknown error'
          );
          controller.error(error);
        }
      },
    });

    // 开始读取流（触发执行）
    const reader = stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

  } catch (error: any) {
    console.error('[Agent Task] Fatal error:', error);
    conversationBuffer.markAgentError(
      conversationId,
      error.message || 'Fatal error'
    );
  }

  console.log(`[Agent Task] Finished for conversation ${conversationId}`);
}
