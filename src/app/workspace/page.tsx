import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function WorkspacePage() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.get('sb-access-token') ||
    cookieStore.get('supabase-auth-token') ||
    cookieStore.get('sb-crlfeaprmayjsthhxbze-auth-token');

  if (!hasSession) {
    redirect('/login');
  }

  // 统一重定向到新的仪表盘页面
  redirect('/dashboard');
}
