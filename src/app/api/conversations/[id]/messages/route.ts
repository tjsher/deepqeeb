import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/conversations/[id]/messages - 获取消息列表
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const messages = db.getMessagesByConversation(conversationId);
    return NextResponse.json(messages);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/conversations/[id]/messages - 创建消息
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { role, content, metadata } = await req.json();

    if (!role || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const message = db.createMessage(conversationId, role, content, metadata);
    return NextResponse.json(message);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
