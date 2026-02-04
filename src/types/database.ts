// DeepQeeb 数据库类型定义

// ==================== 核心表 ====================

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Script {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface File {
  id: string;
  script_id: string;         // 关联到剧本/项目
  path: string;              // 文件路径，如 "/剧本/第一章.md", "/src/game.js"
  content: string;           // 文件内容
  pending_content?: string;  // 待确认的修改内容 (用于 Diff)
  type: 'file' | 'folder';   // 基础文件类型
  mime_type?: string;        // 具体文件类型，如 'text/markdown', 'application/javascript'
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  script_id: string;         // 关联到剧本/项目
  title: string;
  description?: string;

  // 当前/最后使用的 Agent 模式
  last_agent_mode?: 'script' | 'game';

  // 关联的文件 (可选)
  related_files?: string[];  // file_id 数组

  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;

  // 元数据 - 用于标记特殊消息和状态更新
  metadata?: {
    // 消息类型
    type?: 'file_created' | 'file_updated' | 'file_deleted' | 'game_generated' | 'state_update' | 'normal';

    // 关联的文件
    file_id?: string;
    file_path?: string;

    // 关联的游戏
    game_id?: string;
    game_version?: number;

    // 状态更新 (Agent C 输出)
    state_update?: Record<string, any>;

    // 角色信息 (Agent C 输出)
    speaker?: string;
    emotion?: string;
  };

  created_at: string;
}

export interface GameVersion {
  id: string;
  user_id: string;
  conversation_id: string;   // 关联的游戏对话
  version: number;
  code: string;              // 完整 HTML/ESM 代码

  // Agent C 运行时配置
  runtime_config?: {
    // Agent C 的系统提示词模板
    system_prompt_template: string;
    // 初始状态定义
    initial_state: Record<string, any>;
    // 支持的 functions/tools
    available_tools?: string[];
  };

  // 生成时的剧本快照
  script_snapshot: string;
  description?: string;
  created_at: string;
}

export interface ShareLink {
  id: string;                // 短 ID，如 "abc123"
  game_id: string;
  created_by: string;        // 创建者 user_id
  access_count: number;
  last_accessed?: string;
  created_at: string;
}

// ==================== 存档系统 ====================

// 存档 - 存的是 messages 历史，不是状态快照
export interface GameSave {
  id: string;
  game_id: string;
  user_id: string;           // 玩家ID
  slot_number: number;       // 1-3 (付费可解锁更多)

  // 存档内容 - 从第几条消息开始
  // 如果为 0，表示从头开始
  message_offset: number;

  // 当前已应用的状态 (缓存，用于快速加载)
  cached_state?: Record<string, any>;

  // 存档元数据
  meta: {
    name?: string;           // 玩家自定义存档名
    screenshot?: string;     // 存档封面图 (base64 或 URL)
    play_time: number;       // 游戏时长(秒)
    progress_hint?: string;  // 进度提示 (如 "第一章 - 表白成功")
  };

  created_at: string;
  updated_at: string;
}

// ==================== 运行时类型 ====================

// Agent C 输出结构
export interface AgentCOutput {
  dialogue?: {
    speaker: string;
    content: string;
    emotion?: string;
    avatar_url?: string;
  };
  state_update?: Record<string, any>;
  functions?: Array<{
    name: string;
    args: Record<string, any>;
  }>;
  options?: string[];        // 给玩家的选项
}

// 游戏状态 (运行时)
export interface GameState {
  characters: Record<string, {
    name: string;
    attributes: Record<string, any>;
    relationships?: Record<string, string>;
  }>;
  variables: Record<string, any>;
  progress: {
    currentChapter?: string;
    completedEvents: string[];
    flags: Record<string, boolean>;
  };
  inventory: Array<{
    itemId: string;
    name: string;
    quantity: number;
    description?: string;
  }>;
}

// ==================== API 类型 ====================

export interface ChatRequest {
  conversation_id: string;
  message: string;
  attachments?: Array<{
    type: 'image' | 'file';
    url: string;
    name?: string;
  }>;
}

export interface GameStreamRequest {
  game_id: string;
  save_slot?: number;        // 使用哪个存档
  action?: string;           // 玩家输入/选择
  save_state?: boolean;      // 是否保存当前状态
}

// ==================== Skills 系统 ====================

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: 'script' | 'game' | 'runtime';
  content: string;           // prompt 内容
  parameters?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required?: boolean;
    default?: any;
  }>;
  examples?: string[];
}
