'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface FileEditorProps {
  filePath: string | null;
  scriptId: string;
}

export default function FileEditor({ filePath, scriptId }: FileEditorProps) {
  const [content, setContent] = useState('');
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 辅助函数：生成文件 API URL
  const getFileApiUrl = (path: string) => {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const encodedPath = cleanPath.split('/').map(encodeURIComponent).join('/');
    return `/api/scripts/${scriptId}/files/${encodedPath}`;
  };

  // 加载文件内容
  useEffect(() => {
    if (!filePath) {
      setContent('');
      setPendingContent(null);
      return;
    }

    const loadFile = async () => {
      if (!scriptId || scriptId === 'undefined') return;
      setLoading(true);
      setError('');

      try {
        const res = await fetch(getFileApiUrl(filePath));
        if (!res.ok) {
          if (res.status === 404) {
            setContent('');
            setPendingContent(null);
            setError('文件不存在或已被删除');
          } else {
            throw new Error('Failed to load file');
          }
        } else {
          const data = await res.json();
          setContent(data.content || '');
          setPendingContent(data.pending_content || null);
          setError('');
        }
      } catch (err: any) {
        setError('加载文件失败');
        console.error('Load file error:', err);
      }

      setLoading(false);
    };

    loadFile();

    // 清理保存定时器
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [filePath, scriptId]);

  // 自动保存
  const saveFile = useCallback((newContent: string) => {
    if (!filePath) return;
    if (pendingContent) return; // Don't auto-save while diffing

    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 设置新的定时器
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);

      try {
        const res = await fetch(getFileApiUrl(filePath), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newContent }),
        });

        if (!res.ok) {
          console.error('保存失败');
        }
      } catch (err) {
        console.error('保存失败:', err);
      }

      setSaving(false);
    }, 1000);
  }, [filePath, scriptId, pendingContent]);

  const handleAccept = async () => {
    if (!filePath || !pendingContent) return;

    setSaving(true);

    try {
      const res = await fetch(getFileApiUrl(filePath), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert('接受修改失败: ' + error.message);
      } else {
        setContent(pendingContent);
        setPendingContent(null);
      }
    } catch (err: any) {
      alert('接受修改失败: ' + err.message);
    }

    setSaving(false);
  };

  const handleReject = async () => {
    if (!filePath) return;

    try {
      const res = await fetch(getFileApiUrl(filePath), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert('拒绝修改失败: ' + error.message);
      } else {
        setPendingContent(null);
      }
    } catch (err: any) {
      alert('拒绝修改失败: ' + err.message);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    saveFile(newContent);
  };

  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 bg-white">
        <p>选择一个文件开始编辑</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 bg-white">
        <p>加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-500 bg-white">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-gray-500">{filePath}</span>
          <span className="text-xs text-gray-400 italic">
            {pendingContent ? '⚠️ 发现建议修改' : (saving ? '保存中...' : '已保存')}
          </span>
        </div>
        <div className="flex gap-2">
          {pendingContent ? (
            <>
              <button
                onClick={handleReject}
                className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                拒绝修改
              </button>
              <button
                onClick={handleAccept}
                className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                接受修改
              </button>
            </>
          ) : (
            <>
              <button className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">
                预览
              </button>
              <button className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                生成游戏
              </button>
            </>
          )}
        </div>
      </div>

      {/* 编辑区 / Diff 区 */}
      <div className="flex-1 overflow-auto relative">
        {pendingContent ? (
          <div className="flex flex-col h-full bg-gray-50">
            <div className="flex-1 grid grid-cols-2 divide-x divide-gray-200 overflow-auto">
              <div className="p-4 bg-red-50/30">
                <div className="text-[10px] text-red-600 uppercase font-bold mb-2">当前内容 (Old)</div>
                <pre className="text-sm font-mono whitespace-pre-wrap text-gray-700">{content}</pre>
              </div>
              <div className="p-4 bg-green-50/30">
                <div className="text-[10px] text-green-600 uppercase font-bold mb-2">建议修改 (New)</div>
                <pre className="text-sm font-mono whitespace-pre-wrap text-gray-900">{pendingContent}</pre>
              </div>
            </div>
            <div className="p-2 border-t border-gray-200 bg-yellow-50 text-[11px] text-yellow-800 text-center">
              Agent 建议了修改。请对比左侧（当前）和右侧（建议），然后选择接受或拒绝。
            </div>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={handleChange}
            className="w-full h-full p-6 resize-none outline-none font-mono text-sm leading-relaxed text-gray-800"
            placeholder="开始编写剧本..."
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}
