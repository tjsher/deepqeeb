import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/games/[id] - 获取游戏详情
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const game = db.getGameVersionById(id);

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json(game);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
