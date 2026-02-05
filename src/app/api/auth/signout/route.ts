import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // SQLite 版本不需要 auth signout，直接重定向到登录页
  // 在生产环境中应该清除 session/cookie
  return NextResponse.redirect(new URL('/login', req.url));
}
