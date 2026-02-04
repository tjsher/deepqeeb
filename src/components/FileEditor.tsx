'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import debounce from 'lodash/debounce';

interface FileEditorProps {
  filePath: string | null;
  userId: string;
}

export default function FileEditor({ filePath, userId }: FileEditorProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  // 加载文件内容
  useEffect(() => {
    if (!filePath) {
      setContent('');
      return;
    }

    const loadFile = async () => {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('files')
        .select('content')
        .eq('user_id', userId)
        .eq('path', filePath)
        .single();

      if (error) {
        setError('加载文件失败');
        console.error(error);
      } else {
        setContent(data?.content || '');
      }

      setLoading(false);
    };

    loadFile();
  }, [filePath, userId]);

  // 自动保存
  const saveFile = useCallback(
    debounce(async (newContent: string) => {
      if (!filePath) return;

      setSaving(true);
      
      const { error } = await supabase
        .from('files')
        .upsert({
          user_id: userId,
          path: filePath,
          content: newContent,
          type: 'script',
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('保存失败:', error);
      }

      setSaving(false);
    }, 1000),
    [filePath, userId]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    saveFile(newContent);
  };

  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p>选择一个文件开始编辑</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs text-gray-500">
          {saving ? '保存中...' : error ? '保存失败' : '已自动保存'}
        </span>
        <div className="flex gap-2">
          <button className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">
            预览
          </button>
          <button className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
            生成游戏
          </button>
        </div>
      </div>

      {/* 编辑器 */}
      <textarea
        value={content}
        onChange={handleChange}
        className="flex-1 w-full p-4 resize-none outline-none font-mono text-sm leading-relaxed"
        placeholder="开始编写剧本..."
        spellCheck={false}
      />
    </div>
  );
}
