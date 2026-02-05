import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// PUT /api/conversations/[id]/mode - 更新对话模式
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { mode } = await req.json();

    if (!mode || !['script', 'game'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    db.updateConversationMode(id, mode);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
