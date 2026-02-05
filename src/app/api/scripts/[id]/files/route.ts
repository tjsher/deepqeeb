import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/scripts/[id]/files - 获取文件列表
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scriptId } = await params;
    const files = db.getFilesByScript(scriptId);
    return NextResponse.json(files);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/scripts/[id]/files - 创建文件/文件夹
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: scriptId } = await params;
    const { path, name, type, content, is_visible } = await req.json();

    if (!path || !name || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 剧本相关文件默认可见，其他文件默认不可见
    const file = db.createFile(scriptId, path, name, type, content, is_visible);
    return NextResponse.json(file);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
