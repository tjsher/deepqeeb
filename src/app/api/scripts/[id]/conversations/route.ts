import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/scripts/[id]/conversations - 获取对话列表
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scriptId } = await params;
    const conversations = db.getConversationsByScript(scriptId);
    return NextResponse.json(conversations);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/scripts/[id]/conversations - 创建对话
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scriptId } = await params;
    const { title, agentMode } = await req.json();

    const conversation = db.createConversation(scriptId, title || '新对话', agentMode || 'script');
    return NextResponse.json(conversation);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
