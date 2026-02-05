import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

// 确保数据目录存在
const DB_DIR = process.env.DB_DIR || './data';
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'deepqeeb.sqlite');

let db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // 更好的并发性能
    initTables();
  }
  return db;
}

function initTables() {
  if (!db) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      script_id TEXT NOT NULL,
      path TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('file', 'folder')),
      content TEXT,
      pending_content TEXT,
      is_visible BOOLEAN DEFAULT 0, -- 前端是否可见，默认不可见，剧本文件可见
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(script_id, path)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      script_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      last_agent_mode TEXT CHECK(last_agent_mode IN ('script', 'game')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      metadata TEXT, -- JSON string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS game_versions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      code TEXT NOT NULL,
      runtime_config TEXT, -- JSON string
      script_snapshot TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS game_saves (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      message_offset INTEGER DEFAULT 0,
      cached_state TEXT, -- JSON string
      meta TEXT NOT NULL, -- JSON string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS share_links (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      access_count INTEGER DEFAULT 0,
      last_accessed DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_files_script_id ON files(script_id);
    CREATE INDEX IF NOT EXISTS idx_files_path ON files(script_id, path);
    CREATE INDEX IF NOT EXISTS idx_conversations_script_id ON conversations(script_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_game_versions_conversation_id ON game_versions(conversation_id);
  `);
}

// ======== 用户操作 ========
export function createUser(email: string) {
  const db = getDB();
  const id = uuidv4();
  const stmt = db.prepare('INSERT INTO users (id, email) VALUES (?, ?)');
  stmt.run(id, email);
  return { id, email };
}

export function getUserByEmail(email: string) {
  const db = getDB();
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email) as { id: string; email: string; created_at: string } | undefined;
}

export function getUserById(id: string) {
  const db = getDB();
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as { id: string; email: string; created_at: string } | undefined;
}

// ======== 剧本操作 ========
export function createScript(userId: string, name: string, description?: string) {
  const db = getDB();
  const id = uuidv4();
  const stmt = db.prepare('INSERT INTO scripts (id, user_id, name, description) VALUES (?, ?, ?, ?)');
  stmt.run(id, userId, name, description || null);
  return { id, user_id: userId, name, description };
}

export function getScriptsByUser(userId: string) {
  const db = getDB();
  const stmt = db.prepare('SELECT * FROM scripts WHERE user_id = ? ORDER BY updated_at DESC');
  return stmt.all(userId) as any[];
}

export function getScriptById(id: string) {
  const db = getDB();
  const stmt = db.prepare('SELECT * FROM scripts WHERE id = ?');
  return stmt.get(id) as any | undefined;
}

// ======== 文件操作 ========
export function createFile(scriptId: string, filePath: string, name: string, type: 'file' | 'folder', content?: string, isVisible: boolean = false) {
  const db = getDB();
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO files (id, script_id, path, name, type, content, is_visible)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(script_id, path) DO UPDATE SET
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(id, scriptId, filePath, name, type, content || null, isVisible ? 1 : 0);
  return { id, script_id: scriptId, path: filePath, name, type, content, is_visible: isVisible };
}

export function getFilesByScript(scriptId: string, includeInvisible: boolean = false) {
  const db = getDB();
  if (includeInvisible) {
    const stmt = db.prepare('SELECT * FROM files WHERE script_id = ? ORDER BY path');
    return stmt.all(scriptId) as any[];
  } else {
    // 返回可见的文件（is_visible = 1）
    const stmt = db.prepare('SELECT * FROM files WHERE script_id = ? AND is_visible = 1 ORDER BY path');
    return stmt.all(scriptId) as any[];
  }
}

export function getFileByPath(scriptId: string, filePath: string) {
  const db = getDB();
  const stmt = db.prepare('SELECT * FROM files WHERE script_id = ? AND path = ?');
  return stmt.get(scriptId, filePath) as any | undefined;
}

export function updateFileContent(scriptId: string, filePath: string, content: string) {
  const db = getDB();
  const stmt = db.prepare(`
    UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP
    WHERE script_id = ? AND path = ?
  `);
  stmt.run(content, scriptId, filePath);
}

export function updateFilePendingContent(scriptId: string, filePath: string, pendingContent: string | null) {
  const db = getDB();
  const stmt = db.prepare(`
    UPDATE files SET pending_content = ?, updated_at = CURRENT_TIMESTAMP
    WHERE script_id = ? AND path = ?
  `);
  stmt.run(pendingContent, scriptId, filePath);
}

export function deleteFile(scriptId: string, filePath: string) {
  const db = getDB();
  const stmt = db.prepare('DELETE FROM files WHERE script_id = ? AND path = ?');
  stmt.run(scriptId, filePath);
}

export function deleteFilesByPrefix(scriptId: string, pathPrefix: string) {
  const db = getDB();
  const stmt = db.prepare('DELETE FROM files WHERE script_id = ? AND (path = ? OR path LIKE ?)');
  stmt.run(scriptId, pathPrefix, `${pathPrefix}/%`);
}

export function searchFiles(scriptId: string, query: string) {
  const db = getDB();
  const stmt = db.prepare(`
    SELECT path, type FROM files
    WHERE script_id = ? AND (path LIKE ? OR content LIKE ?)
  `);
  const pattern = `%${query}%`;
  return stmt.all(scriptId, pattern, pattern) as any[];
}

// ======== 对话操作 ========
export function createConversation(scriptId: string, title: string, agentMode: 'script' | 'game' = 'script') {
  const db = getDB();
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO conversations (id, script_id, title, last_agent_mode)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, scriptId, title, agentMode);
  return { id, script_id: scriptId, title, last_agent_mode: agentMode };
}

export function getConversationsByScript(scriptId: string) {
  const db = getDB();
  const stmt = db.prepare(`
    SELECT * FROM conversations
    WHERE script_id = ? AND status = 'active'
    ORDER BY updated_at DESC
  `);
  return stmt.all(scriptId) as any[];
}

export function getConversationById(id: string) {
  const db = getDB();
  const stmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
  return stmt.get(id) as any | undefined;
}

export function updateConversationMode(id: string, mode: 'script' | 'game') {
  const db = getDB();
  const stmt = db.prepare(`
    UPDATE conversations SET last_agent_mode = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(mode, id);
}

export function deleteConversation(id: string) {
  const db = getDB();
  const stmt = db.prepare('DELETE FROM conversations WHERE id = ?');
  stmt.run(id);
}

// ======== 消息操作 ========
export function createMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string, metadata?: any) {
  const db = getDB();
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, metadata)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, conversationId, role, content, metadata ? JSON.stringify(metadata) : null);

  // 更新对话的 updated_at
  const updateStmt = db.prepare(`
    UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);
  updateStmt.run(conversationId);

  return { id, conversation_id: conversationId, role, content, metadata };
}

export function getMessagesByConversation(conversationId: string) {
  const db = getDB();
  const stmt = db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `);
  const rows = stmt.all(conversationId) as any[];
  return rows.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
  }));
}

export function deleteMessagesByConversation(conversationId: string) {
  const db = getDB();
  const stmt = db.prepare('DELETE FROM messages WHERE conversation_id = ?');
  stmt.run(conversationId);
}

// ======== 游戏版本操作 ========
export function createGameVersion(data: {
  userId: string;
  conversationId: string;
  version: number;
  code: string;
  scriptSnapshot: string;
  runtimeConfig?: any;
  description?: string;
}) {
  const db = getDB();
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO game_versions (id, user_id, conversation_id, version, code, script_snapshot, runtime_config, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.userId,
    data.conversationId,
    data.version,
    data.code,
    data.scriptSnapshot,
    data.runtimeConfig ? JSON.stringify(data.runtimeConfig) : null,
    data.description || null
  );
  return { id, ...data };
}

export function getGameVersionsByConversation(conversationId: string) {
  const db = getDB();
  const stmt = db.prepare(`
    SELECT * FROM game_versions
    WHERE conversation_id = ?
    ORDER BY version DESC
  `);
  return stmt.all(conversationId) as any[];
}

export function getLatestGameVersion(conversationId: string) {
  const db = getDB();
  const stmt = db.prepare(`
    SELECT * FROM game_versions
    WHERE conversation_id = ?
    ORDER BY version DESC
    LIMIT 1
  `);
  const row = stmt.get(conversationId) as any | undefined;
  if (row && row.runtime_config) {
    row.runtime_config = JSON.parse(row.runtime_config);
  }
  return row;
}

export function getGameVersionById(id: string) {
  const db = getDB();
  const stmt = db.prepare('SELECT * FROM game_versions WHERE id = ?');
  const row = stmt.get(id) as any | undefined;
  if (row && row.runtime_config) {
    row.runtime_config = JSON.parse(row.runtime_config);
  }
  return row;
}
