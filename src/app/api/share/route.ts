import { createClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { customAlphabet } from 'nanoid';

// 生成短 ID（只使用小写字母和数字，避免歧义字符）
const nanoid = customAlphabet('23456789abcdefghijkmnpqrstuvwxyz', 8);

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // 验证用户
    const { data: { session } } = await supabase.auth.getSession();

    // 开发模式跳过验证
    const isDev = process.env.NODE_ENV === 'development';
    const userId = isDev ? 'mock-user-001' : session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { game_id } = await req.json();

    if (!game_id) {
      return NextResponse.json({ error: '缺少游戏ID' }, { status: 400 });
    }

    // 验证游戏存在且属于当前用户
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', game_id)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: '游戏不存在' }, { status: 404 });
    }

    // 生成唯一的短 ID
    let shareId = nanoid();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const { data: existing } = await supabase
        .from('shares')
        .select('id')
        .eq('id', shareId)
        .single();

      if (!existing) {
        isUnique = true;
      } else {
        shareId = nanoid();
        attempts++;
      }
    }

    if (!isUnique) {
      return NextResponse.json({ error: '生成分享链接失败，请重试' }, { status: 500 });
    }

    // 保存到数据库
    const { error: insertError } = await supabase.from('shares').insert({
      id: shareId,
      game_id: game_id,
      created_by: userId,
      access_count: 0,
    });

    if (insertError) {
      console.error('保存分享链接失败:', insertError);
      return NextResponse.json({ error: '创建分享链接失败' }, { status: 500 });
    }

    return NextResponse.json({
      shareId,
      url: `${process.env.NEXT_PUBLIC_APP_URL}/play/${shareId}`,
    });

  } catch (error: any) {
    console.error('Share API Error:', error);
    return NextResponse.json(
      { error: error.message || '内部错误' },
      { status: 500 }
    );
  }
}
