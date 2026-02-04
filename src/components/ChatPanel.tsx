'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import type { Conversation, Message } from '@/types/database';

interface ChatPanelProps {
  conversationId: string;
  userId: string;
  onClose: () => void;
}

export default function ChatPanel({ conversationId, userId, onClose }: ChatPanelProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentMode, setAgentMode] = useState<'script' | 'game'>('script');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  // 加载对话信息
  useEffect(() => {
    const loadConversation = async () => {
      if (!conversationId || conversationId === 'undefined') return;
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) {
        console.error('加载对话失败:', error);
        return;
      }

      setConversation(data);
      if (data.last_agent_mode) {
        setAgentMode(data.last_agent_mode);
      }

      // 加载历史消息
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (msgError) {
        console.error('加载消息失败:', msgError);
      } else {
        setMessages(msgData || []);
      }
      setLoading(false);
    };

    loadConversation();
  }, [conversationId]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 更新模式
  const handleModeChange = async (mode: 'script' | 'game') => {
    setAgentMode(mode);
    // Update DB
    await supabase
      .from('conversations')
      .update({ last_agent_mode: mode })
      .eq('id', conversationId);
  };

  // 发送消息
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput('');
    setIsStreaming(true);

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
      // 保存用户消息到数据库
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
      });

      // 准备发送给 AI 的消息历史
      const chatMessages = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));
      chatMessages.push({ role: 'user', content: userMessage });

      // 调用 AI API
      console.log('Sending request to /api/chat...', {
        conversation_id: conversationId,
        script_id: conversation?.script_id,
        agent_mode: agentMode,
        messages: chatMessages
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          messages: chatMessages,
          script_id: conversation?.script_id, // Pass Script ID
          agent_mode: agentMode // Pass current mode
        }),
      });

      console.log('API Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error details:', errorData);
        throw new Error(`请求失败: ${response.status} ${errorData.error || ''}`);
      }

      // 读取流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      if (reader) {
        console.log('Starting to read stream...');
        const tempAssistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          conversation_id: conversationId,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, tempAssistantMsg]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('Stream finished.');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          console.log('Received chunk:', chunk);
          assistantContent += chunk;

          setMessages(prev =>
            prev.map(m =>
              m.id === tempAssistantMsg.id
                ? { ...m, content: assistantContent }
                : m
            )
          );
        }
      } else {
        console.warn('No reader found in response body');
      }

    } catch (error) {
      console.error('发送消息失败:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        conversation_id: conversationId,
        role: 'assistant',
        content: '抱歉，发送消息时出现错误，请重试。',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, conversationId, messages, conversation, agentMode]);

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

        {messages.map((message, index) => (
          <div
            key={message.id || index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-900'
                }`}
            >
              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
              {message.role === 'assistant' && isStreaming && index === messages.length - 1 && (
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse ml-1" />
              )}
            </div>
          </div>
        ))}
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
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${agentMode === 'script' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
              }`}
          >
            {isStreaming ? '发送中...' : '发送'}
          </button>
        </form>
      </div>
    </div>
  );
}
