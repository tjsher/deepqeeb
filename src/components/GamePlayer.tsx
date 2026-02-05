'use client';

import { useState, useEffect } from 'react';

interface GamePlayerProps {
  gameId: string;
}

export default function GamePlayer({ gameId }: GamePlayerProps) {
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadGame();
  }, [gameId]);

  const loadGame = async () => {
    try {
      const res = await fetch(`/api/games/${gameId}`);
      if (!res.ok) throw new Error('Game not found');
      const data = await res.json();
      setGame(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>加载游戏中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        <p>错误: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {game?.code ? (
        <iframe
          srcDoc={game.code}
          className="w-full h-screen border-0"
          sandbox="allow-scripts allow-same-origin"
        />
      ) : (
        <div className="min-h-screen flex items-center justify-center">
          <p>游戏加载失败</p>
        </div>
      )}
    </div>
  );
}
