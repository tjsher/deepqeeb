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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  // 加载对话信息
  useEffect(() => {
    const loadConversation = async () => {
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
      
      // 加载历史消息
      const { data: msgData } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      setMessages(msgData || []);
      setLoading(false);
    };

    loadConversation();
  }, [conversationId]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          messages: chatMessages,
        }),
      });

      if (!response.ok) {
        throw new Error('请求失败');
      }

      // 读取流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      if (reader) {
        // 添加临时的助手消息
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
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          assistantContent += chunk;

          // 更新助手消息内容
          setMessages(prev => 
            prev.map(m => 
              m.id === tempAssistantMsg.id 
                ? { ...m, content: assistantContent } 
                : m
            )
          );
        }
      }

    } catch (error) {
      console.error('发送消息失败:', error);
      // 显示错误消息
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
  }, [input, isStreaming, conversationId, messages]);

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
        <div className="flex items-center gap-2">
          <span className="text-lg">{conversation?.type === 'script' ? '📝' : '🎮'}</span>
          <div>
            <h3 className="font-medium text-gray-900">{conversation?.title}</h3>
            <p className="text-xs text-gray-500">
              {conversation?.type === 'script' ? '剧本创作模式' : '游戏生成模式'}
            </p>
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
              {conversation?.type === 'script'
                ? '描述你想创作的故事...'
                : '告诉我如何调整游戏...'}
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={message.id || index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
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
              conversation?.type === 'script'
                ? '输入消息让 AI 帮你写剧本...'
                : '输入消息调整游戏...'
            }
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming ? '发送中...' : '发送'}
          </button>
        </form>
        
        {/* 快捷操作 */}
        {conversation?.type === 'script' && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setInput('帮我生成游戏')}
              className="text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            >
              生成游戏
            </button>
            <button 
              onClick={() => setInput('整理当前剧本')}
              className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              整理剧本
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
