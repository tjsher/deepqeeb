'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { GameVersion } from '@/types/database';

interface GamePreviewProps {
  conversationId: string;
  userId: string;
}

export default function GamePreview({ conversationId, userId }: GamePreviewProps) {
  const [games, setGames] = useState<GameVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  const supabase = createClient();

  useEffect(() => {
    loadGames();
  }, [conversationId]);

  const loadGames = async () => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('version', { ascending: true });

    if (error) {
      console.error('加载游戏失败:', error);
      return;
    }

    setGames(data || []);
    if (data && data.length > 0) {
      setActiveVersion(data[data.length - 1].version);
    }
    setLoading(false);
  };

  const activeGame = games.find(g => g.version === activeVersion);

  const handleShare = async () => {
    if (!activeGame) return;

    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: activeGame.id }),
      });

      if (!response.ok) throw new Error('创建分享链接失败');

      const { shareId } = await response.json();
      const shareUrl = `${window.location.origin}/play/${shareId}`;
      
      // 复制到剪贴板
      await navigator.clipboard.writeText(shareUrl);
      alert(`分享链接已复制: ${shareUrl}`);
    } catch (error) {
      console.error('分享失败:', error);
      alert('分享失败，请重试');
    }
  };

  const handleDownload = () => {
    if (!activeGame) return;
    
    const blob = new Blob([activeGame.code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game-v${activeVersion}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p>加载中...</p>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-4">
        <p className="text-lg mb-2">暂无游戏版本</p>
        <p className="text-sm text-center">
          在对话框中发送"生成游戏"来创建第一个版本
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 版本切换栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">版本:</span>
          <div className="flex gap-1">
            {games.map((game) => (
              <button
                key={game.version}
                onClick={() => setActiveVersion(game.version)}
                className={`px-3 py-1 text-xs rounded ${
                  activeVersion === game.version
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                v{game.version}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            title="刷新预览"
          >
            🔄
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            ⬇️ 下载
          </button>
          <button
            onClick={handleShare}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔗 分享
          </button>
        </div>
      </div>

      {/* 游戏信息 */}
      {activeGame && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-700">
            版本 {activeGame.version} · {new Date(activeGame.created_at).toLocaleString()}
            {activeGame.description && ` · ${activeGame.description}`}
          </p>
        </div>
      )}

      {/* 游戏预览 iframe */}
      <div className="flex-1 relative">
        {activeGame ? (
          <iframe
            key={iframeKey}
            srcDoc={activeGame.code}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title={`Game v${activeVersion}`}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            <p>选择版本查看预览</p>
          </div>
        )}
      </div>
    </div>
  );
}
