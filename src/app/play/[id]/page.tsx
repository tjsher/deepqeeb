'use client';

import { useState, useEffect } from 'react';

interface PlayPageProps {
  params: Promise<{ id: string }>;
}

export default function PlayPage({ params }: PlayPageProps) {
  const [shareId, setShareId] = useState<string>('');
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    params.then(p => {
      setShareId(p.id);
      loadGame(p.id);
    });
  }, [params]);

  const loadGame = async (id: string) => {
    try {
      const res = await fetch(`/api/share/${id}`);
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
        <p>加载中...</p>
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
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">游戏</h1>
        <p>Share ID: {shareId}</p>
        <pre className="mt-4 p-4 bg-gray-800 rounded overflow-auto">
          {JSON.stringify(game, null, 2)}
        </pre>
      </div>
    </div>
  );
}
