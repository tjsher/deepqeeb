'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Script } from '@/types/database';

interface ScriptListProps {
  userId: string;
}

export default function ScriptList({ userId }: ScriptListProps) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadScripts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/scripts`);
      if (!res.ok) throw new Error('Failed to load scripts');
      const data = await res.json();
      setScripts(data || []);
    } catch (error) {
      console.error('加载剧本失败:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadScripts();
  }, [userId]);

  const handleCreate = async () => {
    const name = prompt('请输入剧本名称');
    if (!name) return;

    try {
      const res = await fetch(`/api/users/${userId}/scripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: 'New Script Project',
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert('创建失败: ' + error.message);
        return;
      }

      const data = await res.json();
      router.push(`/script/${data.id}`);
    } catch (error: any) {
      alert('创建失败: ' + error.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">加载中...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800">我的剧本</h1>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span>+</span>
          <span>新建剧本</span>
        </button>
      </div>

      {scripts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-4">还没有剧本</p>
          <button
            onClick={handleCreate}
            className="text-blue-600 hover:text-blue-800"
          >
            创建一个开始 →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts.map((script) => (
            <div
              key={script.id}
              onClick={() => router.push(`/script/${script.id}`)}
              className="p-6 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
            >
              <h3 className="font-semibold text-gray-900 mb-2">{script.name}</h3>
              <p className="text-sm text-gray-500 line-clamp-2">{script.description}</p>
              <div className="mt-4 text-xs text-gray-400">
                {new Date(script.updated_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
