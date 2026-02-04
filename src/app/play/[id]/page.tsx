import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import GamePlayer from '@/components/GamePlayer';

interface PlayPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PlayPage({ params }: PlayPageProps) {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 获取分享链接对应的游戏
  const { data: share, error: shareError } = await supabase
    .from('shares')
    .select('*, games(*)')
    .eq('id', id)
    .single();

  if (shareError || !share) {
    notFound();
  }

  // 更新访问次数
  await supabase
    .from('shares')
    .update({
      access_count: (share.access_count || 0) + 1,
      last_accessed: new Date().toISOString(),
    })
    .eq('id', id);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* 顶部栏 */}
      <header className="h-12 bg-gray-800 text-white flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-bold">DeepQeeb</h1>
          <span className="text-gray-400">|</span>
          <span className="text-gray-300 text-sm">{share.games?.description || '未命名游戏'}</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/workspace"
            className="text-sm text-gray-400 hover:text-white"
          >
            创建自己的游戏
          </a>
        </div>
      </header>

      {/* 游戏区域 */}
      <main className="flex-1 overflow-hidden">
        <GamePlayer
          gameId={share.games.id}
          gameCode={share.games.code}
          runtimeConfig={share.games.runtime_config}
        />
      </main>
    </div>
  );
}
