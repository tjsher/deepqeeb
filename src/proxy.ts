import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(req: NextRequest) {
  // SQLite 版本简化认证检查
  // 生产环境中应该使用真实的 session/cookie 机制

  // 需要登录才能访问的页面
  const protectedRoutes = ['/dashboard', '/script', '/api/chat', '/workspace'];
  const isProtectedRoute = protectedRoutes.some((route) =>
    req.nextUrl.pathname.startsWith(route)
  );

  // 开发模式跳过认证
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  // 生产环境：检查自定义 session（简化实现）
  const hasSession = req.cookies.get('session');

  // 未登录用户访问受保护页面，重定向到登录页
  if (!hasSession && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
