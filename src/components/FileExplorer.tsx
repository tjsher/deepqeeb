'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface FileExplorerProps {
  userId: string;
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

export default function FileExplorer({ userId, onFileSelect, selectedFile }: FileExplorerProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));

  const supabase = createClient();

  useEffect(() => {
    loadFiles();
  }, [userId]);

  const loadFiles = async () => {
    const { data, error } = await supabase
      .from('files')
      .select('path, type')
      .eq('user_id', userId)
      .order('path');

    if (error) {
      console.error('加载文件失败:', error);
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
          className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100 ${
            isSelected ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
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

  return (
    <div className="py-2">
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase">文件目录</span>
        <button
          className="text-xs text-blue-600 hover:text-blue-800"
          onClick={() => {/* TODO: 创建文件/文件夹 */}}
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
