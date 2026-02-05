import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/share/[id] - 获取分享的游戏
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shareId } = await params;

    // 获取分享链接
    const share = db.getDB().prepare('SELECT * FROM share_links WHERE id = ?').get(shareId);

    if (!share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    // 获取游戏
    const game = db.getGameVersionById(share.game_id);

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // 更新访问计数
    db.getDB().prepare(`
      UPDATE share_links SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(shareId);

    return NextResponse.json(game);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
