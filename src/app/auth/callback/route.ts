import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            cookie: cookieStore.toString(),
          },
        },
      }
    );
    
    await supabase.auth.exchangeCodeForSession(code);
  }

  // 登录成功后跳转到工作区
  return NextResponse.redirect(new URL('/workspace', request.url));
}
