import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Mock 用户数据（仅开发模式使用）
export const MOCK_USER = {
  id: 'mock-user-001',
  email: 'dev@deepqeeb.com',
  name: '开发测试用户',
};

export async function middleware(req: NextRequest) {
  // 开发模式：自动使用 mock 用户
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // 开发模式下直接放行
    return NextResponse.next();
  }

  // 生产模式：检查登录状态
  const hasSession = req.cookies.get('sb-access-token') || req.cookies.get('supabase-auth-token');

  // 需要登录才能访问的页面
  const protectedRoutes = ['/workspace', '/api/chat', '/files'];
  const isProtectedRoute = protectedRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );

  // 未登录用户访问受保护页面，重定向到登录页
  if (!hasSession && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
