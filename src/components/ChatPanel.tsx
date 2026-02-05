'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Conversation, Message } from '@/types/database';
import { useStream } from '@/hooks/useStream';

interface ChatPanelProps {
  conversationId: string;
  userId: string;
  onClose: () => void;
}

// 工具调用摘要组件 - 紧凑显示，包含执行结果
function ToolCallSummary({ toolCalls }: { toolCalls: any[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div className="mt-2 border border-gray-300 rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 flex items-center gap-2 text-xs text-gray-600">
        <span>🔧</span>
        <span>工具调用 ({toolCalls.length})</span>
      </div>

      <div className="p-2 bg-gray-50 space-y-1">
        {toolCalls.map((tc, idx) => (
          <div key={idx} className="bg-white rounded border border-gray-200 overflow-hidden">
            <button
              onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
              className="w-full flex items-center gap-2 p-2 text-xs hover:bg-gray-50 transition-colors"
            >
              <span className={`px-2 py-0.5 rounded whitespace-nowrap font-medium ${
                tc.status === 'success' ? 'bg-green-100 text-green-700' :
                tc.status === 'error' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {tc.status === 'success' ? '✓' : tc.status === 'error' ? '✗' : '⏳'}
              </span>
              <span className="text-gray-800 flex-1 truncate font-medium">{tc.name}</span>
              <span className="text-gray-500">{expandedIndex === idx ? '▼' : '▶'}</span>
            </button>

            {expandedIndex === idx && (
              <div className="border-t border-gray-200 p-2 bg-gray-50 space-y-2">
                {Object.keys(tc.parameters).length > 0 && (
                  <div>
                    <div className="text-xs text-gray-600 font-medium mb-1">参数:</div>
                    <pre className="text-xs bg-white p-1 rounded border border-gray-200 overflow-x-auto max-h-20 overflow-y-auto">
                      {JSON.stringify(tc.parameters, null, 2)}
                    </pre>
                  </div>
                )}

                {tc.result && (
                  <div>
                    <div className="text-xs text-gray-600 font-medium mb-1">结果:</div>
                    <pre className="text-xs bg-white p-1 rounded border border-gray-200 overflow-x-auto max-h-24 overflow-y-auto text-gray-700">
                      {typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 思考过程显示组件 - 只显示最新的 reasoning
function ReasoningDisplay({ reasoning }: { reasoning?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!reasoning) return null;

  return (
    <div className="mt-2 border border-blue-300 rounded-md overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 bg-blue-50 hover:bg-blue-100 flex items-center justify-between text-xs text-blue-600 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>💭</span>
          <span>AI 的思考</span>
        </span>
        <span>{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="p-3 bg-blue-50">
          <pre className="text-xs bg-white p-2 rounded border border-blue-200 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
            {reasoning}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function ChatPanel({ conversationId, userId, onClose }: ChatPanelProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [agentMode, setAgentMode] = useState<'script' | 'game'>('script');
  const [streamingContent, setStreamingContent] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasConnectedRef = useRef(false);

  // 使用新的 useStream hook
  const { state: streamState, connect, disconnect, isConnected } = useStream({
    conversationId,
    onMessage: (content) => {
      // 累积流式内容
      setStreamingContent((prev) => prev + content);
    },
    onComplete: () => {
      // 流完成，刷新消息列表
      loadMessages();
      setStreamingContent('');
    },
    onError: (error) => {
      console.error('Stream error:', error);
      setStreamingContent('');
    },
    fastRenderThreshold: 1000,
  });

  // 加载对话信息
  useEffect(() => {
    const loadConversation = async () => {
      if (!conversationId) return;

      try {
        const res = await fetch(`/api/conversations/${conversationId}`);
        if (!res.ok) throw new Error('Failed to load conversation');
        const data = await res.json();
        setConversation(data);
        if (data.last_agent_mode) {
          setAgentMode(data.last_agent_mode);
        }

        // 加载历史消息
        await loadMessages();
      } catch (error) {
        console.error('加载对话失败:', error);
      }

      setLoading(false);
    };

    loadConversation();
  }, [conversationId]);

  // 加载消息列表
  const loadMessages = async () => {
    try {
      const msgRes = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!msgRes.ok) throw new Error('Failed to load messages');
      const msgData = await msgRes.json();
      setMessages(msgData);
    } catch (error) {
      console.error('加载消息失败:', error);
    }
  };

  // 检查是否需要自动连接（页面刷新后恢复）
  useEffect(() => {
    if (!hasConnectedRef.current && !loading && conversationId) {
      hasConnectedRef.current = true;
      // 尝试连接，如果有运行中的任务会自动恢复
      connect();
    }

    return () => {
      disconnect();
    };
  }, [conversationId, loading, connect, disconnect]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // 更新模式
  const handleModeChange = async (mode: 'script' | 'game') => {
    setAgentMode(mode);
    // Update via API
    await fetch(`/api/conversations/${conversationId}/mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
  };

  // 发送消息
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!input.trim() || isConnected) return;

    const userMessage = input.trim();
    setInput('');
    setStreamingContent('');

    // 添加用户消息到界面
    const tempUserMsg: Message = {
      id: Date.now().toString(),
      conversation_id: conversationId,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // 准备发送给 AI 的消息历史
      const chatMessages = messages.map(m => ({
        id: m.id,
        role: m.role,
        parts: [{ type: 'text' as const, text: m.content }],
      }));
      chatMessages.push({
        id: Date.now().toString(),
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: userMessage }]
      });

      // 调用 AI API 创建 Agent 任务
      console.log('Creating agent task...', {
        conversation_id: conversationId,
        script_id: conversation?.script_id,
        agent_mode: agentMode,
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          messages: chatMessages,
          script_id: conversation?.script_id,
          agent_mode: agentMode
        }),
      });

      console.log('API Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error details:', errorData);
        throw new Error(`请求失败: ${response.status} ${errorData.error || ''}`);
      }

      const result = await response.json();
      console.log('Agent task created:', result);

      // 连接到 Stream API 获取流式输出
      connect();

    } catch (error) {
      console.error('发送消息失败:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        conversation_id: conversationId,
        role: 'assistant',
        content: '抱歉，发送消息时出现错误，请重试。',
        created_at: new Date().toISOString(),
      }]);
    }
  }, [input, isConnected, conversationId, messages, conversation, agentMode, connect]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:bg-gray-200 rounded"
            title="返回列表"
          >
            ←
          </button>

          {/* Agent Mode Toggle */}
          <div className="flex bg-gray-200 rounded-lg p-1">
            <button
              onClick={() => handleModeChange('script')}
              className={`px-3 py-1 text-xs rounded-md transition-all ${agentMode === 'script'
                ? 'bg-white text-blue-600 shadow-sm font-medium'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              📝 剧本 Agent
            </button>
            <button
              onClick={() => handleModeChange('game')}
              className={`px-3 py-1 text-xs rounded-md transition-all ${agentMode === 'game'
                ? 'bg-white text-purple-600 shadow-sm font-medium'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              🎮 游戏生成 Agent
            </button>
          </div>

          <div className="border-l border-gray-300 h-6 mx-1"></div>

          <div>
            <h3 className="font-medium text-gray-900 truncate max-w-[200px]">{conversation?.title}</h3>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p className="text-lg mb-2">开始对话</p>
            <p className="text-sm">
              选择上方 Agent 模式，开始创作或生成游戏。
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          const isToolCalls = message.metadata?.type === 'tool_calls';
          const hasToolCalls = message.metadata?.tool_calls && message.metadata.tool_calls.length > 0;
          const reasoning = message.metadata?.reasoning;

          return (
            <div
              key={message.id || index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 ${message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : isToolCalls
                    ? 'bg-amber-50 text-gray-900 border border-amber-200'
                    : 'bg-gray-100 text-gray-900'
                  }`}
              >
                {/* 消息内容 */}
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>

                {/* AI 思考过程 - 只显示最新的 reasoning */}
                {reasoning && (
                  <ReasoningDisplay reasoning={reasoning} />
                )}

                {/* 工具调用摘要 - 紧凑显示 */}
                {hasToolCalls && (
                  <ToolCallSummary toolCalls={message.metadata!.tool_calls!} />
                )}

                {/* 流式响应指示器 */}
                {message.role === 'assistant' && isConnected && index === messages.length - 1 && (
                  <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse ml-1" />
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              agentMode === 'script'
                ? '输入内容，Agent 将帮你完善剧本...'
                : '输入指令，Agent 将帮你生成/修改游戏代码...'
            }
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isConnected}
          />
          <button
            type="submit"
            disabled={isConnected || !input.trim()}
            className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${agentMode === 'script' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
              }`}
          >
            {isConnected ? '发送中...' : '发送'}
          </button>
        </form>
      </div>
    </div>
  );
}
