'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { Conversation } from '@/types/database';

interface ConversationListProps {
  scriptId: string;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export default function ConversationList({
  scriptId,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    loadConversations();
  }, [scriptId]);

  const loadConversations = async () => {
    if (!scriptId || scriptId === 'undefined') return;
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('script_id', scriptId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('加载对话失败:', error);
      return;
    }

    setConversations(data || []);
    setLoading(false);
  };

  const createNewConversation = async () => {
    const title = '新对话';

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        script_id: scriptId,
        title,
        status: 'active',
        last_agent_mode: 'script' // Default to script mode
      })
      .select()
      .single();

    if (error) {
      console.error('创建对话失败:', error);
      return;
    }

    setConversations([data, ...conversations]);
    onSelectConversation(data.id);
  };

  const formatTime = (date: string) => {
    const now = new Date();
    const target = new Date(date);
    const diff = now.getTime() - target.getTime();

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return target.toLocaleDateString();
  };

  if (loading) {
    return <div className="p-4 text-gray-500">加载中...</div>;
  }

  return (
    <div className="py-2">
      {/* 新建按钮 */}
      <div className="px-4 py-2">
        <button
          onClick={createNewConversation}
          className="w-full py-2 px-3 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <span>+</span> 新建对话
        </button>
      </div>

      {/* 对话列表 */}
      <div className="mt-2">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            <p>暂无对话</p>
            <p className="mt-1">点击上方按钮创建新对话</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={`px-4 py-3 cursor-pointer hover:bg-gray-100 ${activeConversationId === conv.id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
                }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {conv.last_agent_mode === 'game' ? '🎮' : '📝'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {conv.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatTime(conv.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
