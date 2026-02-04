'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { Conversation } from '@/types/database';

interface ConversationListProps {
  userId: string;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export default function ConversationList({
  userId,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'script' | 'game'>('all');

  const supabase = createClient();

  useEffect(() => {
    loadConversations();
  }, [userId]);

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('加载对话失败:', error);
      return;
    }

    setConversations(data || []);
    setLoading(false);
  };

  const createNewConversation = async (type: 'script' | 'game') => {
    const title = type === 'script' ? '新剧本' : '新游戏';
    
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        type,
        title,
        status: 'active',
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

  const filteredConversations = conversations.filter((conv) => {
    if (filter === 'all') return true;
    return conv.type === filter;
  });

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
      <div className="px-4 py-2 flex gap-2">
        <button
          onClick={() => createNewConversation('script')}
          className="flex-1 py-2 px-3 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + 剧本对话
        </button>
        <button
          onClick={() => createNewConversation('game')}
          className="flex-1 py-2 px-3 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
        >
          + 游戏对话
        </button>
      </div>

      {/* 筛选 */}
      <div className="px-4 py-2 flex gap-1">
        {(['all', 'script', 'game'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 text-xs rounded ${
              filter === f
                ? 'bg-gray-800 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f === 'all' ? '全部' : f === 'script' ? '剧本' : '游戏'}
          </button>
        ))}
      </div>

      {/* 对话列表 */}
      <div className="mt-2">
        {filteredConversations.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            <p>暂无对话</p>
            <p className="mt-1">创建一个新对话开始</p>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={`px-4 py-3 cursor-pointer hover:bg-gray-100 ${
                activeConversationId === conv.id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {conv.type === 'script' ? '📝' : '🎮'}
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
