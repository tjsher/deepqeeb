import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/conversations/[id]/games/latest - 获取最新游戏版本
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const game = db.getLatestGameVersion(conversationId);

    if (!game) {
      return NextResponse.json({ error: 'No game found' }, { status: 404 });
    }

    return NextResponse.json(game);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
