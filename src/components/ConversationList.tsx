'use client';

import { useState, useEffect } from 'react';
import type { Conversation } from '@/types/database';

interface ConversationListProps {
  scriptId: string;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation?: (id: string) => void;
}

export default function ConversationList({
  scriptId,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();

    // 定期刷新（每 5 秒）
    const interval = setInterval(() => {
      loadConversations();
    }, 5000);

    return () => clearInterval(interval);
  }, [scriptId]);

  const loadConversations = async () => {
    if (!scriptId || scriptId === 'undefined') return;

    try {
      const res = await fetch(`/api/scripts/${scriptId}/conversations`);
      if (!res.ok) throw new Error('Failed to load conversations');
      const data = await res.json();
      setConversations(data || []);
    } catch (error) {
      console.error('加载对话失败:', error);
    }

    setLoading(false);
  };

  const createNewConversation = async () => {
    const title = '新对话';

    try {
      const res = await fetch(`/api/scripts/${scriptId}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, agentMode: 'script' }),
      });

      if (!res.ok) throw new Error('Failed to create conversation');

      const data = await res.json();
      setConversations([data, ...conversations]);
      onSelectConversation(data.id);
    } catch (error) {
      console.error('创建对话失败:', error);
    }
  };

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个对话吗？此操作不可恢复。')) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        alert('删除失败: ' + error.message);
        return;
      }

      // 更新本地状态
      setConversations(prev => prev.filter(c => c.id !== id));
      onDeleteConversation?.(id);
    } catch (error) {
      console.error('删除对话出错:', error);
    } finally {
      setDeletingId(null);
    }
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
              className={`group px-4 py-3 cursor-pointer hover:bg-gray-100 ${activeConversationId === conv.id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
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
                <button
                  onClick={(e) => deleteConversation(e, conv.id)}
                  disabled={deletingId === conv.id}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                  title="删除对话"
                >
                  {deletingId === conv.id ? (
                    <span className="text-xs">...</span>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
