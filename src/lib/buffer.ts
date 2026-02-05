/**
 * 内存 Buffer 模块
 * 
 * 用于管理 Agent 任务的流式输出
 * 支持：创建任务、写入数据、读取数据、任务管理
 */

import { v4 as uuidv4 } from 'uuid';

// ==================== 类型定义 ====================

export type AgentTaskStatus = 'running' | 'completed' | 'error' | 'stopped';

export interface AgentTask {
  id: string;
  conversationId: string;
  scriptId: string;
  agentMode: 'script' | 'game';
  status: AgentTaskStatus;
  streamMessages: string;
  lastMessageIndex: number;
  lastStreamOutputIndex: number;
  createdAt: Date;
  updatedAt: Date;
  errorMessage?: string;
}

export interface StreamEvent {
  type: 'chunk' | 'message_finished' | 'agent_finished' | 'agent_error';
  content?: string;
  error?: string;
}

// ==================== Buffer 状态 ====================

class ConversationBuffer {
  // 存储所有正在运行的 Agent 任务
  private tasks: Map<string, AgentTask> = new Map();
  
  // 存储每个 conversation 的订阅者（用于推送更新）
  private subscribers: Map<string, Set<(event: StreamEvent) => void>> = new Map();
  
  // Buffer 过期时间（毫秒）- 60秒
  private readonly BUFFER_TTL = 60 * 1000;
  
  // 最后访问时间
  private lastAccessTime: Map<string, number> = new Map();

  // ==================== 任务管理 ====================

  /**
   * 创建新的 Agent 任务
   */
  createTask(
    conversationId: string,
    scriptId: string,
    agentMode: 'script' | 'game',
    initialMessages: string
  ): AgentTask {
    const task: AgentTask = {
      id: uuidv4(),
      conversationId,
      scriptId,
      agentMode,
      status: 'running',
      streamMessages: initialMessages,
      lastMessageIndex: -1,
      lastStreamOutputIndex: -1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.set(conversationId, task);
    this.lastAccessTime.set(conversationId, Date.now());
    this.subscribers.set(conversationId, new Set());

    console.log(`[Buffer] Created task for conversation ${conversationId}`);
    return task;
  }

  /**
   * 获取任务
   */
  getTask(conversationId: string): AgentTask | undefined {
    this.updateAccessTime(conversationId);
    return this.tasks.get(conversationId);
  }

  /**
   * 检查任务是否存在
   */
  hasTask(conversationId: string): boolean {
    return this.tasks.has(conversationId);
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(conversationId: string): AgentTaskStatus | undefined {
    const task = this.tasks.get(conversationId);
    return task?.status;
  }

  // ==================== 流式数据写入 ====================

  /**
   * 写入 chunk（token）
   */
  writeChunk(conversationId: string, chunk: string): void {
    const task = this.tasks.get(conversationId);
    if (!task) {
      console.warn(`[Buffer] Task not found for conversation ${conversationId}`);
      return;
    }

    task.streamMessages += chunk;
    task.updatedAt = new Date();
    this.updateAccessTime(conversationId);

    // 通知订阅者
    this.notifySubscribers(conversationId, {
      type: 'chunk',
      content: chunk,
    });
  }

  /**
   * 标记消息完成
   */
  markMessageFinished(conversationId: string): void {
    const task = this.tasks.get(conversationId);
    if (!task) return;

    task.lastMessageIndex = task.streamMessages.length;
    task.updatedAt = new Date();
    this.updateAccessTime(conversationId);

    // 通知订阅者
    this.notifySubscribers(conversationId, {
      type: 'message_finished',
    });

    console.log(`[Buffer] Message finished for conversation ${conversationId}`);
  }

  /**
   * 标记 Agent 任务完成
   */
  markAgentFinished(conversationId: string): void {
    const task = this.tasks.get(conversationId);
    if (!task) return;

    task.status = 'completed';
    task.updatedAt = new Date();
    this.updateAccessTime(conversationId);

    // 通知订阅者
    this.notifySubscribers(conversationId, {
      type: 'agent_finished',
    });

    console.log(`[Buffer] Agent finished for conversation ${conversationId}`);
  }

  /**
   * 标记 Agent 任务出错
   */
  markAgentError(conversationId: string, errorMessage: string): void {
    const task = this.tasks.get(conversationId);
    if (!task) return;

    task.status = 'error';
    task.errorMessage = errorMessage;
    task.updatedAt = new Date();
    this.updateAccessTime(conversationId);

    // 通知订阅者
    this.notifySubscribers(conversationId, {
      type: 'agent_error',
      error: errorMessage,
    });

    console.log(`[Buffer] Agent error for conversation ${conversationId}: ${errorMessage}`);
  }

  /**
   * 停止 Agent 任务
   */
  stopTask(conversationId: string): void {
    const task = this.tasks.get(conversationId);
    if (!task) return;

    task.status = 'stopped';
    task.updatedAt = new Date();
    this.updateAccessTime(conversationId);

    console.log(`[Buffer] Task stopped for conversation ${conversationId}`);
  }

  // ==================== 流式数据读取 ====================

  /**
   * 获取从指定位置开始的流式数据
   */
  getStreamData(
    conversationId: string,
    fromIndex: number
  ): { data: string; lastMessageIndex: number; lastStreamOutputIndex: number } | null {
    const task = this.tasks.get(conversationId);
    if (!task) return null;

    this.updateAccessTime(conversationId);

    return {
      data: task.streamMessages.slice(fromIndex),
      lastMessageIndex: task.lastMessageIndex,
      lastStreamOutputIndex: task.lastStreamOutputIndex,
    };
  }

  /**
   * 获取完整状态（用于前端初始化）
   */
  getFullState(conversationId: string): {
    streamMessages: string;
    lastMessageIndex: number;
    lastStreamOutputIndex: number;
    status: AgentTaskStatus;
  } | null {
    const task = this.tasks.get(conversationId);
    if (!task) return null;

    this.updateAccessTime(conversationId);

    return {
      streamMessages: task.streamMessages,
      lastMessageIndex: task.lastMessageIndex,
      lastStreamOutputIndex: task.lastStreamOutputIndex,
      status: task.status,
    };
  }

  /**
   * 更新前端读取位置
   */
  updateStreamOutputIndex(conversationId: string, index: number): void {
    const task = this.tasks.get(conversationId);
    if (!task) return;

    task.lastStreamOutputIndex = index;
    task.updatedAt = new Date();
  }

  // ==================== 订阅机制 ====================

  /**
   * 订阅流式事件
   */
  subscribe(
    conversationId: string,
    callback: (event: StreamEvent) => void
  ): () => void {
    let subs = this.subscribers.get(conversationId);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(conversationId, subs);
    }

    subs.add(callback);

    // 返回取消订阅函数
    return () => {
      subs?.delete(callback);
    };
  }

  /**
   * 通知订阅者
   */
  private notifySubscribers(conversationId: string, event: StreamEvent): void {
    const subs = this.subscribers.get(conversationId);
    if (!subs) return;

    subs.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('[Buffer] Error notifying subscriber:', error);
      }
    });
  }

  // ==================== 清理机制 ====================

  /**
   * 更新访问时间
   */
  private updateAccessTime(conversationId: string): void {
    this.lastAccessTime.set(conversationId, Date.now());
  }

  /**
   * 清理过期的任务
   */
  cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.lastAccessTime.forEach((lastAccess, conversationId) => {
      if (now - lastAccess > this.BUFFER_TTL) {
        toDelete.push(conversationId);
      }
    });

    toDelete.forEach((conversationId) => {
      this.tasks.delete(conversationId);
      this.subscribers.delete(conversationId);
      this.lastAccessTime.delete(conversationId);
      console.log(`[Buffer] Cleaned up expired task for conversation ${conversationId}`);
    });
  }

  /**
   * 手动删除任务
   */
  deleteTask(conversationId: string): void {
    this.tasks.delete(conversationId);
    this.subscribers.delete(conversationId);
    this.lastAccessTime.delete(conversationId);
    console.log(`[Buffer] Deleted task for conversation ${conversationId}`);
  }

  // ==================== 统计信息 ====================

  /**
   * 获取统计信息
   */
  getStats(): {
    totalTasks: number;
    runningTasks: number;
    completedTasks: number;
    errorTasks: number;
  } {
    let running = 0;
    let completed = 0;
    let error = 0;

    this.tasks.forEach((task) => {
      if (task.status === 'running') running++;
      else if (task.status === 'completed') completed++;
      else if (task.status === 'error') error++;
    });

    return {
      totalTasks: this.tasks.size,
      runningTasks: running,
      completedTasks: completed,
      errorTasks: error,
    };
  }
}

// ==================== 单例导出 ====================

export const conversationBuffer = new ConversationBuffer();

// 定期清理过期任务（每30秒）
setInterval(() => {
  conversationBuffer.cleanup();
}, 30000);

export default conversationBuffer;
