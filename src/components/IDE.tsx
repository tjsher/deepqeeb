'use client';

import { useState, useCallback } from 'react';
import FileExplorer from './FileExplorer';
import ChatPanel from './ChatPanel';
import FileEditor from './FileEditor';
import ConversationList from './ConversationList';

interface IDEProps {
  userId: string;
}

export default function IDE({ userId }: IDEProps) {
  // 三栏宽度状态
  const [leftWidth, setLeftWidth] = useState(250);      // 文件目录
  const [middleWidth, setMiddleWidth] = useState(400);  // 文件编辑器
  const [rightWidth, setRightWidth] = useState(500);    // 对话框
  
  // 显示状态
  const [showEditor, setShowEditor] = useState(false);
  const [activeTab, setActiveTab] = useState<'files' | 'conversations'>('files');
  
  // 当前选中
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // 拖拽调整宽度
  const handleDragLeft = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = leftWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      setLeftWidth(Math.max(200, Math.min(400, startWidth + delta)));
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [leftWidth]);

  const handleDragMiddle = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = middleWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      setMiddleWidth(Math.max(300, Math.min(600, startWidth + delta)));
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [middleWidth]);

  // 点击文件
  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
    setShowEditor(true);
  };

  // 创建新对话
  const handleNewConversation = () => {
    // TODO: 创建新对话并跳转到对话页面
    console.log('创建新对话');
  };

  return (
    <div className="flex h-full bg-gray-100">
      {/* 左侧：文件目录 / 对话列表 */}
      <div 
        className="flex flex-col bg-white border-r border-gray-200"
        style={{ width: leftWidth }}
      >
        {/* 标签切换 */}
        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium ${
              activeTab === 'files' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setActiveTab('files')}
          >
            📁 文件
          </button>
          <button
            className={`flex-1 py-2 px-4 text-sm font-medium ${
              activeTab === 'conversations' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setActiveTab('conversations')}
          >
            💬 对话
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'files' ? (
            <FileExplorer 
              userId={userId}
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
            />
          ) : (
            <ConversationList
              userId={userId}
              activeConversationId={activeConversationId}
              onSelectConversation={setActiveConversationId}
              onNewConversation={handleNewConversation}
            />
          )}
        </div>
      </div>

      {/* 左分隔线 */}
      <div
        className="w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
        onMouseDown={handleDragLeft}
      />

      {/* 中间：文件编辑器 (可收起) */}
      {showEditor && (
        <>
          <div 
            className="flex flex-col bg-white border-r border-gray-200"
            style={{ width: middleWidth }}
          >
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700 truncate">
                {selectedFile || '未选择文件'}
              </span>
              <button
                onClick={() => setShowEditor(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <FileEditor 
                filePath={selectedFile}
                userId={userId}
              />
            </div>
          </div>

          {/* 中分隔线 */}
          <div
            className="w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
            onMouseDown={handleDragMiddle}
          />
        </>
      )}

      {/* 右侧：对话框 */}
      <div className="flex-1 flex flex-col bg-white min-w-[400px]">
        {activeConversationId ? (
          <ChatPanel 
            conversationId={activeConversationId}
            userId={userId}
            onClose={() => setActiveConversationId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-2">选择一个对话开始</p>
              <p className="text-sm">或创建新对话</p>
              <button
                onClick={handleNewConversation}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + 新对话
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
