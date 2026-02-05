'use client';

import { useState, useEffect } from 'react';

interface GamePreviewProps {
  conversationId: string;
  userId: string;
}

export default function GamePreview({ conversationId, userId }: GamePreviewProps) {
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLatestGame();
  }, [conversationId]);

  const loadLatestGame = async () => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/games/latest`);
      if (!res.ok) throw new Error('No game found');
      const data = await res.json();
      setGame(data);
    } catch (error) {
      console.error('加载游戏失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p>加载游戏...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p>暂无游戏预览</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <iframe
        srcDoc={game.code}
        className="flex-1 w-full border-0"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
