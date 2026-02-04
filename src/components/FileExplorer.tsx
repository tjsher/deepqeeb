'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface FileExplorerProps {
  scriptId: string;
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

export default function FileExplorer({ scriptId, onFileSelect, selectedFile }: FileExplorerProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));

  const supabase = createClient();

  useEffect(() => {
    loadFiles();
  }, [scriptId]);

  const loadFiles = async () => {
    if (!scriptId || scriptId === 'undefined') return;
    const { data, error } = await supabase
      .from('files')
      .select('path, type')
      .eq('script_id', scriptId)
      .order('path');

    if (error) {
      console.error('加载文件失败:', error.message || error);
      return;
    }

    // 构建文件树
    const tree = buildFileTree(data || []);
    setFiles(tree);
    setLoading(false);
  };

  const buildFileTree = (files: { path: string; type: string }[]): FileNode[] => {
    const root: FileNode[] = [];
    const map = new Map<string, FileNode>();

    files.forEach((file) => {
      const parts = file.path.split('/').filter(Boolean);
      let currentPath = '';

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;

        if (!map.has(currentPath)) {
          const node: FileNode = {
            name: part,
            path: currentPath,
            type: isLast ? 'file' : 'folder',
            children: isLast ? undefined : [],
          };

          map.set(currentPath, node);

          if (parentPath) {
            const parent = map.get(parentPath);
            if (parent && parent.children) {
              parent.children.push(node);
            }
          } else {
            root.push(node);
          }
        }
      });
    });

    return root;
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;

    return (
      <div key={node.path}>
        <div
          className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 ${isSelected ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
            }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (node.type === 'folder') {
              toggleFolder(node.path);
            } else {
              onFileSelect(node.path);
            }
          }}
        >
          <span className="mr-1 text-sm">
            {node.type === 'folder' ? (isExpanded ? '📂' : '📁') : '📄'}
          </span>
          <span className="text-sm truncate">{node.name}</span>
        </div>

        {node.type === 'folder' && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="p-4 text-gray-500">加载中...</div>;
  }

  const handleCreate = async () => {
    // 简单实现：使用 prompt 获取名称
    // 后续优化：改为 UI 弹窗
    const type = prompt('创建类型 (输入 "file" 或 "folder")', 'file');
    if (type !== 'file' && type !== 'folder') return;

    const name = prompt(`请输入${type === 'file' ? '文件' : '文件夹'}名称`);
    if (!name) return;

    // 默认在根目录创建，后续支持选中目录
    const parentPath = selectedFile && files.find(f => f.path === selectedFile && f.type === 'folder')
      ? selectedFile
      : '';

    let path = parentPath ? `${parentPath}/${name}` : `/${name}`;
    if (!path.startsWith('/')) path = '/' + path;

    // 如果是文件，补全后缀
    if (type === 'file' && !path.includes('.')) {
      path += '.md';
    }

    setLoading(true);
    const { error } = await supabase.from('files').insert({
      script_id: scriptId,
      path,
      type,
      content: type === 'file' ? '# New File' : null,
      name: name // DB Schema update requires name? Or we removed it? 
      // Wait, Schema has 'name'. Our previous SQL update kept 'name'.
      // Let's ensure we provide it.
    });

    setLoading(false);

    if (error) {
      alert('创建失败: ' + error.message);
      console.error(error);
    } else {
      loadFiles(); // 刷新列表
    }
  };

  return (
    <div className="py-2">
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase">剧本文件</span>
        <button
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          onClick={handleCreate}
        >
          + 新建
        </button>
      </div>
      {files.length === 0 ? (
        <div className="px-4 py-8 text-center text-gray-400 text-sm">
          <p>暂无文件</p>
          <p className="mt-1">开始创建剧本吧</p>
        </div>
      ) : (
        files.map((node) => renderNode(node))
      )}
    </div>
  );
}
