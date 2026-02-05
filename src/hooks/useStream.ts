'use client';

/**
 * HTTP Stream Hook
 * 
 * 用于前端获取 Agent 任务的流式输出
 * 支持：初始连接、重连恢复、快速/流式渲染切换
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ==================== 类型定义 ====================

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'completed' | 'error';

export interface StreamState {
  streamMessages: string;
  lastMessageIndex: number;
  lastStreamOutputIndex: number;
  status: StreamStatus;
  error?: string;
}

export interface StreamEvent {
  type: 'init' | 'chunk' | 'message_finished' | 'agent_finished' | 'agent_error';
  content?: string;
  streamMessages?: string;
  lastMessageIndex?: number;
  lastStreamOutputIndex?: number;
  status?: string;
  error?: string;
}

export interface UseStreamOptions {
  conversationId: string;
  onMessage?: (content: string) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  fastRenderThreshold?: number;
}

export interface UseStreamReturn {
  state: StreamState;
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
}

// ==================== Hook 实现 ====================

const DEFAULT_FAST_RENDER_THRESHOLD = 1000;

export function useStream(options: UseStreamOptions): UseStreamReturn {
  const {
    conversationId,
    onMessage,
    onComplete,
    onError,
    fastRenderThreshold = DEFAULT_FAST_RENDER_THRESHOLD,
  } = options;

  // 状态
  const [state, setState] = useState<StreamState>({
    streamMessages: '',
    lastMessageIndex: -1,
    lastStreamOutputIndex: -1,
    status: 'idle',
  });

  const [isConnected, setIsConnected] = useState(false);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const isRenderingRef = useRef(false);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ==================== 渲染逻辑 ====================

  /**
   * 快速渲染：一次性显示所有堆积的数据
   */
  const fastRender = useCallback((data: string, startIndex: number) => {
    const endIndex = startIndex + data.length;
    
    // 调用回调，让父组件处理渲染
    if (onMessage) {
      onMessage(data);
    }

    setState((prev) => ({
      ...prev,
      lastStreamOutputIndex: endIndex,
    }));
  }, [onMessage]);

  /**
   * 流式渲染：逐个字符显示
   */
  const streamRender = useCallback((chunk: string, startIndex: number) => {
    if (isRenderingRef.current) {
      // 如果正在渲染，直接追加
      if (onMessage) {
        onMessage(chunk);
      }
      setState((prev) => ({
        ...prev,
        lastStreamOutputIndex: startIndex + chunk.length,
      }));
      return;
    }

    isRenderingRef.current = true;

    // 逐个字符渲染
    const chars = chunk.split('');
    let currentIndex = 0;

    const renderNext = () => {
      if (currentIndex >= chars.length) {
        isRenderingRef.current = false;
        setState((prev) => ({
          ...prev,
          lastStreamOutputIndex: startIndex + chars.length,
        }));
        return;
      }

      const char = chars[currentIndex];
      if (onMessage) {
        onMessage(char);
      }

      currentIndex++;
      setState((prev) => ({
        ...prev,
        lastStreamOutputIndex: startIndex + currentIndex,
      }));

      // 控制渲染速度（每10ms一个字符）
      renderTimeoutRef.current = setTimeout(renderNext, 10);
    };

    renderNext();
  }, [onMessage]);

  /**
   * 判断使用哪种渲染模式
   */
  const decideRenderMode = useCallback((accumulatedData: number): 'fast' | 'stream' => {
    return accumulatedData > fastRenderThreshold ? 'fast' : 'stream';
  }, [fastRenderThreshold]);

  // ==================== 连接管理 ====================

  /**
   * 建立连接
   */
  const connect = useCallback(() => {
    if (isConnected) {
      console.log('[useStream] Already connected');
      return;
    }

    // 取消之前的连接
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setState((prev) => ({ ...prev, status: 'connecting' }));
    setIsConnected(true);

    // 构建 URL（支持从指定位置重连）
    const fromIndex = state.lastStreamOutputIndex >= 0 ? state.lastStreamOutputIndex : -1;
    const url = `/api/stream/${conversationId}${fromIndex >= 0 ? `?fromIndex=${fromIndex}` : ''}`;

    console.log(`[useStream] Connecting to ${url}`);

    fetch(url, {
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        setState((prev) => ({ ...prev, status: 'streaming' }));

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: StreamEvent = JSON.parse(line.slice(6));
                handleEvent(event);
              } catch (e) {
                console.error('[useStream] Failed to parse event:', line, e);
              }
            }
          }
        }

        console.log('[useStream] Stream completed');
        setIsConnected(false);
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          console.log('[useStream] Connection aborted');
        } else {
          console.error('[useStream] Connection error:', error);
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: error.message,
          }));
          if (onError) {
            onError(error.message);
          }
        }
        setIsConnected(false);
      });
  }, [conversationId, isConnected, state.lastStreamOutputIndex, onError]);

  /**
   * 处理流式事件
   */
  const handleEvent = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case 'init':
        // 初始化状态
        setState({
          streamMessages: event.streamMessages || '',
          lastMessageIndex: event.lastMessageIndex ?? -1,
          lastStreamOutputIndex: event.lastStreamOutputIndex ?? -1,
          status: event.status === 'completed' ? 'completed' : 'streaming',
        });

        // 如果有堆积的数据，立即渲染
        if (event.streamMessages && event.lastStreamOutputIndex !== undefined) {
          const accumulatedData = event.streamMessages.length - event.lastStreamOutputIndex;
          if (accumulatedData > 0 && event.lastStreamOutputIndex >= 0) {
            const pendingData = event.streamMessages.slice(event.lastStreamOutputIndex + 1);
            const mode = decideRenderMode(accumulatedData);
            
            if (mode === 'fast') {
              fastRender(pendingData, event.lastStreamOutputIndex);
            } else {
              streamRender(pendingData, event.lastStreamOutputIndex);
            }
          }
        }
        break;

      case 'chunk':
        // 接收到新数据
        if (event.content) {
          setState((prev) => {
            const newStreamMessages = prev.streamMessages + event.content;
            const accumulatedData = newStreamMessages.length - prev.lastStreamOutputIndex;
            const mode = decideRenderMode(accumulatedData);

            // 根据模式渲染
            if (mode === 'fast') {
              fastRender(event.content!, prev.lastStreamOutputIndex);
            } else {
              streamRender(event.content!, prev.lastStreamOutputIndex);
            }

            return {
              ...prev,
              streamMessages: newStreamMessages,
            };
          });
        }
        break;

      case 'message_finished':
        // 消息完成
        setState((prev) => ({
          ...prev,
          lastMessageIndex: prev.streamMessages.length,
        }));
        break;

      case 'agent_finished':
        // Agent 完成
        setState((prev) => ({
          ...prev,
          status: 'completed',
          lastMessageIndex: prev.streamMessages.length,
          lastStreamOutputIndex: prev.streamMessages.length,
        }));
        if (onComplete) {
          onComplete();
        }
        break;

      case 'agent_error':
        // Agent 出错
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: event.error,
        }));
        if (onError && event.error) {
          onError(event.error);
        }
        break;
    }
  }, [decideRenderMode, fastRender, streamRender, onComplete, onError]);

  /**
   * 断开连接
   */
  const disconnect = useCallback(() => {
    console.log('[useStream] Disconnecting');
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = null;
    }

    isRenderingRef.current = false;
    setIsConnected(false);
  }, []);

  // ==================== 生命周期 ====================

  // 清理
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    state,
    connect,
    disconnect,
    isConnected,
  };
}

export default useStream;
