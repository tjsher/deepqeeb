import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  // 统一检查登录状态
  const cookieStore = await cookies();
  const hasSession = cookieStore.get('sb-access-token') ||
    cookieStore.get('supabase-auth-token') ||
    cookieStore.get('sb-crlfeaprmayjsthhxbze-auth-token');

  if (hasSession) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
