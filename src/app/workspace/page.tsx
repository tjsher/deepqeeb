import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import IDE from '@/components/IDE';

export default async function WorkspacePage() {
  const cookieStore = cookies();
  
  // 从 cookies 中获取 supabase 会话
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          cookie: cookieStore.toString(),
        },
      },
    }
  );
  
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="h-screen flex flex-col">
      {/* 顶部导航栏 */}
      <header className="h-12 bg-gray-900 text-white flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-lg">DeepQeeb</h1>
          <span className="text-gray-400 text-sm">|</span>
          <span className="text-gray-300 text-sm">工作区</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{session.user.email}</span>
          <form action="/api/auth/signout" method="post">
            <button 
              type="submit"
              className="text-sm text-gray-300 hover:text-white"
            >
              退出
            </button>
          </form>
        </div>
      </header>
      
      {/* IDE 主体 */}
      <main className="flex-1 overflow-hidden">
        <IDE userId={session.user.id} />
      </main>
    </div>
  );
}
