import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const isDev = process.env.NODE_ENV === 'development';
  
  // 开发模式：直接跳转到工作区
  if (isDev) {
    redirect('/workspace');
  }
  
  // 生产模式：检查登录状态
  const cookieStore = await cookies();
  const hasSession = cookieStore.get('sb-access-token') || cookieStore.get('supabase-auth-token');
  
  if (hasSession) {
    redirect('/workspace');
  } else {
    redirect('/login');
  }
}
