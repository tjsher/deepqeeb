import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/users/[id]/scripts - 获取用户的剧本列表
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const scripts = db.getScriptsByUser(userId);
    return NextResponse.json(scripts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/users/[id]/scripts - 创建剧本
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const { name, description } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // 创建剧本
    const script = db.createScript(userId, name, description);

    // 创建初始文件（剧本相关文件夹默认可见）
    db.createFile(script.id, '/剧本', '剧本', 'folder', undefined, false);
    db.createFile(script.id, '/游戏', '游戏', 'folder', undefined, true);

    return NextResponse.json(script);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
