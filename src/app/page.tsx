import { redirect } from 'next/navigation';

export default function Home() {
  // 直接跳转到登录页
  redirect('/login');
}
