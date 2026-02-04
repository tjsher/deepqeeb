import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import IDE from '@/components/IDE';
import { MOCK_USER } from '@/middleware';

export default async function WorkspacePage() {
  const isDev = process.env.NODE_ENV === 'development';
  
  // 开发模式：使用 mock 用户
  if (isDev) {
    return (
      <div className="h-screen flex flex-col">
        {/* 顶部导航栏 */}
        <header className="h-12 bg-gray-900 text-white flex items-center px-4 justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-bold text-lg">DeepQeeb</h1>
            <span className="text-gray-400 text-sm">|</span>
            <span className="text-gray-300 text-sm">工作区</span>
            <span className="ml-2 px-2 py-0.5 bg-yellow-600 text-xs rounded">DEV MODE</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{MOCK_USER.email}</span>
            <a 
              href="/login"
              className="text-sm text-gray-300 hover:text-white"
            >
              退出
            </a>
          </div>
        </header>
        
        {/* IDE 主体 */}
        <main className="flex-1 overflow-hidden">
          <IDE userId={MOCK_USER.id} />
        </main>
      </div>
    );
  }

  // 生产模式：正常认证流程
  const cookieStore = cookies();
  
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
