import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/scripts/[id]/files/[...path] - 获取单个文件
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  try {
    const { id: scriptId, path } = await params;
    const filePath = '/' + path.join('/');

    const file = db.getFileByPath(scriptId, filePath);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json(file);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/scripts/[id]/files/[...path] - 更新文件内容
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  try {
    const { id: scriptId, path } = await params;
    const filePath = '/' + path.join('/');
    const { content, action } = await req.json();

    // 处理 accept/reject 操作
    if (action === 'accept') {
      const file = db.getFileByPath(scriptId, filePath);
      if (!file || !file.pending_content) {
        return NextResponse.json({ error: 'No pending changes' }, { status: 400 });
      }
      db.updateFileContent(scriptId, filePath, file.pending_content);
      db.updateFilePendingContent(scriptId, filePath, null);
      return NextResponse.json({ success: true });
    }

    if (action === 'reject') {
      db.updateFilePendingContent(scriptId, filePath, null);
      return NextResponse.json({ success: true });
    }

    // 普通更新
    if (content !== undefined) {
      db.updateFileContent(scriptId, filePath, content);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/scripts/[id]/files/[...path] - 删除文件或文件夹
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  try {
    const { id: scriptId, path } = await params;
    const filePath = '/' + path.join('/');

    // 获取文件信息
    const file = db.getFileByPath(scriptId, filePath);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.type === 'folder') {
      db.deleteFilesByPrefix(scriptId, filePath);
    } else {
      db.deleteFile(scriptId, filePath);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
