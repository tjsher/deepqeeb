import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';


export async function middleware(req: NextRequest) {
  // 生产/开发模式：统一检查登录状态
  const hasSession = req.cookies.get('sb-access-token') ||
    req.cookies.get('supabase-auth-token') ||
    req.cookies.get('sb-crlfeaprmayjsthhxbze-auth-token'); // Supabase default cookie name pattern

  // 需要登录才能访问的页面
  const protectedRoutes = ['/dashboard', '/script', '/api/chat', '/workspace'];
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
