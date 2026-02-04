'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';

interface GamePlayerProps {
  gameId: string;
  gameCode: string;
  runtimeConfig?: {
    system_prompt_template: string;
    initial_state: Record<string, any>;
    available_tools?: string[];
  };
}

export default function GamePlayer({ gameId, gameCode, runtimeConfig }: GamePlayerProps) {
  const [saveSlots, setSaveSlots] = useState<Array<{
    slot: number;
    exists: boolean;
    progress?: string;
    updated_at?: string;
  }>>([
    { slot: 1, exists: false },
    { slot: 2, exists: false },
    { slot: 3, exists: false },
  ]);
  const [currentSlot, setCurrentSlot] = useState<number | null>(null);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [gameState, setGameState] = useState<Record<string, any>>({});
  const [messages, setMessages] = useState<Array<{role: string; content: string}>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const supabase = createClient();

  // 加载存档列表
  useEffect(() => {
    loadSaveSlots();
  }, [gameId]);

  const loadSaveSlots = async () => {
    // Mock 用户 ID，生产环境从 session 获取
    const mockUserId = 'mock-player-001';
    
    const { data } = await supabase
      .from('saves')
      .select('*')
      .eq('game_id', gameId)
      .eq('user_id', mockUserId)
      .order('slot_number', { ascending: true });

    if (data) {
      const newSlots = [1, 2, 3].map(slot => {
        const save = data.find((s: any) => s.slot_number === slot);
        return {
          slot,
          exists: !!save,
          progress: save?.meta?.progress_hint,
          updated_at: save?.updated_at,
        };
      });
      setSaveSlots(newSlots);
    }
  };

  // 开始新游戏
  const startNewGame = async () => {
    // 找到第一个空槽位
    const emptySlot = saveSlots.find(s => !s.exists)?.slot || 1;
    
    // 初始化游戏状态
    const initialState = runtimeConfig?.initial_state || {
      characters: {},
      variables: {},
      progress: { completedEvents: [], flags: {} },
      inventory: [],
    };

    setCurrentSlot(emptySlot);
    setGameState(initialState);
    setMessages([]);
    setShowSaveMenu(false);

    // 发送初始消息给 Agent C
    await sendToAgentC('开始游戏', initialState, []);
  };

  // 继续游戏
  const continueGame = async (slot: number) => {
    const mockUserId = 'mock-player-001';
    
    const { data: save } = await supabase
      .from('saves')
      .select('*')
      .eq('game_id', gameId)
      .eq('user_id', mockUserId)
      .eq('slot_number', slot)
      .single();

    if (save) {
      setCurrentSlot(slot);
      setGameState(save.state || {});
      setMessages(save.messages || []);
      setShowSaveMenu(false);
    }
  };

  // 发送消息给 Agent C
  const sendToAgentC = async (action: string, state: any, history: any[]) => {
    setIsStreaming(true);

    try {
      const response = await fetch('/api/game/agentc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: gameId,
          action,
          state,
          history,
        }),
      });

      if (!response.ok) throw new Error('请求失败');

      // 读取流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;

          // 实时更新到 iframe
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
              type: 'agentc_stream',
              content: fullResponse,
            }, '*');
          }
        }
      }

      // 解析最终响应
      const parsed = parseAgentCOutput(fullResponse);
      
      // 更新状态
      const newState = mergeState(state, parsed.state_update || {});
      setGameState(newState);
      
      // 添加到消息历史
      const newHistory = [...history, { role: 'user', content: action }];
      if (parsed.dialogue) {
        newHistory.push({
          role: 'assistant',
          content: parsed.dialogue.speaker + ': ' + parsed.dialogue.content,
        });
      }
      setMessages(newHistory);

      // 自动保存
      await autoSave(currentSlot!, newState, newHistory);

    } catch (error) {
      console.error('Agent C 请求失败:', error);
    } finally {
      setIsStreaming(false);
    }
  };

  // 解析 Agent C 输出
  const parseAgentCOutput = (text: string) => {
    const dialogueMatch = text.match(/<dialogue>[\s\S]*?<speaker>(.*?)<\/speaker>[\s\S]*?<content>(.*?)<\/content>[\s\S]*?<\/dialogue>/);
    const stateUpdateMatch = text.match(/<state_update>([\s\S]*?)<\/state_update>/);
    
    return {
      dialogue: dialogueMatch ? {
        speaker: dialogueMatch[1].trim(),
        content: dialogueMatch[2].trim(),
      } : null,
      state_update: stateUpdateMatch ? JSON.parse(stateUpdateMatch[1]) : null,
    };
  };

  // 合并状态
  const mergeState = (current: any, update: any) => {
    return {
      ...current,
      ...update,
      characters: { ...current.characters, ...update.characters },
      variables: { ...current.variables, ...update.variables },
    };
  };

  // 自动保存
  const autoSave = async (slot: number, state: any, messages: any[]) => {
    const mockUserId = 'mock-player-001';
    
    await supabase.from('saves').upsert({
      game_id: gameId,
      user_id: mockUserId,
      slot_number: slot,
      state,
      messages,
      meta: {
        progress_hint: state.progress?.currentChapter || '进行中',
      },
      updated_at: new Date().toISOString(),
    });

    // 刷新存档列表
    loadSaveSlots();
  };

  // 如果没有选择槽位，显示开始菜单
  if (!currentSlot) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="max-w-md w-full bg-gray-800 rounded-lg p-8">
          <h1 className="text-2xl font-bold text-white mb-6 text-center">开始游戏</h1>
          
          {/* 存档槽位 */}
          <div className="space-y-3 mb-6">
            {saveSlots.map((slot) => (
              <button
                key={slot.slot}
                onClick={() => slot.exists ? continueGame(slot.slot) : null}
                disabled={!slot.exists}
                className={`w-full p-4 rounded-lg text-left transition-colors ${
                  slot.exists
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">存档 {slot.slot}</span>
                  {slot.exists ? (
                    <span className="text-sm text-blue-200">
                      {slot.progress} · {new Date(slot.updated_at!).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-sm">空</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* 新游戏按钮 */}
          <button
            onClick={startNewGame}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            开始新游戏
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* 游戏 iframe */}
      <div className="flex-1 relative">
        <iframe
          ref={iframeRef}
          srcDoc={gameCode}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin"
          title="Game"
        />
        
        {isStreaming && (
          <div className="absolute bottom-4 right-4 bg-black/70 text-white px-4 py-2 rounded">
            AI 思考中...
          </div>
        )}
      </div>

      {/* 侧边栏 - 存档管理 */}
      <div className="w-64 bg-gray-800 border-l border-gray-700 p-4">
        <h3 className="text-white font-medium mb-4">存档管理</h3>
        
        <div className="space-y-2">
          <button
            onClick={() => autoSave(currentSlot, gameState, messages)}
            disabled={isStreaming}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm"
          >
            保存当前进度
          </button>
          
          <button
            onClick={() => setCurrentSlot(null)}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
          >
            返回主菜单
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-700">
          <h4 className="text-gray-400 text-sm mb-2">当前存档</h4>
          <p className="text-white text-sm">槽位 {currentSlot}</p>
          <p className="text-gray-500 text-xs mt-1">
            {gameState.progress?.currentChapter || '第一章'}
          </p>
        </div>
      </div>
    </div>
  );
}
