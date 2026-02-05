import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import crypto from 'crypto';

// 生成短 ID（8位，只使用小写字母和数字）
function generateShortId(): string {
  const chars = '23456789abcdefghijkmnpqrstuvwxyz';
  let result = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export async function POST(req: Request) {
  try {
    // 开发模式跳过验证
    const isDev = process.env.NODE_ENV === 'development';
    const userId = isDev ? 'mock-user-001' : 'mock-user-001'; // 简化处理

    const { game_id } = await req.json();

    if (!game_id) {
      return NextResponse.json({ error: '缺少游戏ID' }, { status: 400 });
    }

    // 验证游戏存在
    const game = db.getGameVersionById(game_id);
    if (!game) {
      return NextResponse.json({ error: '游戏不存在' }, { status: 404 });
    }

    // 生成唯一的短 ID
    let shareId = generateShortId();
    let isUnique = false;
    let attempts = 0;

    // 检查是否已存在（简单实现：在 share_links 表中检查）
    while (!isUnique && attempts < 10) {
      const existing = db.getDB().prepare('SELECT id FROM share_links WHERE id = ?').get(shareId);
      if (!existing) {
        isUnique = true;
      } else {
        shareId = generateShortId();
        attempts++;
      }
    }

    if (!isUnique) {
      return NextResponse.json({ error: '生成分享链接失败，请重试' }, { status: 500 });
    }

    // 保存到数据库
    const stmt = db.getDB().prepare(`
      INSERT INTO share_links (id, game_id, created_by, access_count)
      VALUES (?, ?, ?, 0)
    `);
    stmt.run(shareId, game_id, userId);

    return NextResponse.json({
      shareId,
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/play/${shareId}`,
    });

  } catch (error: any) {
    console.error('Share API Error:', error);
    return NextResponse.json(
      { error: error.message || '内部错误' },
      { status: 500 }
    );
  }
}
