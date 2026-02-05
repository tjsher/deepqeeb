'use client';

import { useState, useEffect } from 'react';

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

  useEffect(() => {
    loadFiles();

    // 定期刷新文件列表（每 3 秒）
    const interval = setInterval(() => {
      loadFiles();
    }, 3000);

    return () => clearInterval(interval);
  }, [scriptId]);

  const loadFiles = async () => {
    if (!scriptId || scriptId === 'undefined') return;

    try {
      const res = await fetch(`/api/scripts/${scriptId}/files`);
      if (!res.ok) throw new Error('Failed to load files');
      const data = await res.json();

      // 构建文件树
      const tree = buildFileTree(data || []);
      setFiles(tree);
    } catch (error) {
      console.error('加载文件失败:', error);
    }

    setLoading(false);
  };

  const buildFileTree = (files: { path: string; type: string }[]): FileNode[] => {
    const root: FileNode[] = [];
    const map = new Map<string, FileNode>();

    // 第一遍：创建所有节点，使用数据库中的 type
    files.forEach((file) => {
      const parts = file.path.split('/').filter(Boolean);
      let currentPath = '';

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;

        if (!map.has(currentPath)) {
          // 使用数据库返回的 type（仅对最后一个部分），中间路径都是文件夹
          const nodeType = isLast ? (file.type as 'file' | 'folder') : 'folder';
          const node: FileNode = {
            name: part,
            path: currentPath,
            type: nodeType,
            children: nodeType === 'folder' ? [] : undefined,
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

  const deleteNode = async (e: React.MouseEvent, node: FileNode) => {
    e.stopPropagation();

    const confirmMsg = node.type === 'folder'
      ? `确定要删除文件夹 "${node.name}" 吗？\n文件夹内的所有内容都会被删除，此操作不可恢复。`
      : `确定要删除文件 "${node.name}" 吗？此操作不可恢复。`;

    if (!confirm(confirmMsg)) return;

    try {
      // 移除开头的 /，分段编码路径
      const cleanPath = node.path.startsWith('/') ? node.path.slice(1) : node.path;
      const encodedPath = cleanPath.split('/').map(encodeURIComponent).join('/');
      const res = await fetch(`/api/scripts/${scriptId}/files/${encodedPath}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`删除失败: ${error.message || '未知错误'}`);
        return;
      }

      // 如果删除的是当前选中的文件，通知父组件取消选中
      if (selectedFile === node.path) {
        onFileSelect('');
      }

      // 刷新列表
      loadFiles();
    } catch (error: any) {
      alert(`删除出错: ${error.message}`);
    }
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;

    return (
      <div key={node.path}>
        <div
          className={`group flex items-center justify-between py-1 px-2 cursor-pointer hover:bg-gray-100 ${isSelected ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
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
          <div className="flex items-center flex-1 min-w-0">
            <span className="mr-1 text-sm">
              {node.type === 'folder' ? (isExpanded ? '📂' : '📁') : '📄'}
            </span>
            <span className="text-sm truncate">{node.name}</span>
          </div>

          {/* 删除按钮 - 鼠标悬停时显示 */}
          <button
            onClick={(e) => deleteNode(e, node)}
            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
            title={`删除${node.type === 'folder' ? '文件夹' : '文件'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
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
    const type = prompt('创建类型 (输入 "file" 或 "folder")', 'file');
    if (type !== 'file' && type !== 'folder') return;

    const name = prompt(`请输入${type === 'file' ? '文件' : '文件夹'}名称`);
    if (!name) return;

    const parentPath = selectedFile && files.find(f => f.path === selectedFile && f.type === 'folder')
      ? selectedFile
      : '';

    let filePath = parentPath ? `${parentPath}/${name}` : `/${name}`;
    if (!filePath.startsWith('/')) filePath = '/' + filePath;

    if (type === 'file' && !filePath.includes('.')) {
      filePath += '.md';
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/scripts/${scriptId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: filePath,
          name: name,
          type,
          content: type === 'file' ? '# New File' : null,
          is_visible: true, // 用户通过前端创建的文件默认可见
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert('创建失败: ' + error.message);
      }
    } catch (error: any) {
      alert('创建失败: ' + error.message);
    }

    setLoading(false);
    loadFiles();
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
