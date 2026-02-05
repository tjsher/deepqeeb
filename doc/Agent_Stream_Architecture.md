# Agent 流式输出架构设计方案

## 问题背景

用户刷新网页会导致与后端的连接断开，导致 Agent 任务停止。需要重新架构以实现：
- Agent 任务独立于前端连接运行
- 前端刷新后能无缝恢复
- 实时流式显示和历史查看统一处理

## 核心设计思想

使用**内存 Buffer + 两个指针**，前后端维护相同的数据结构，实现对称的消息处理逻辑。

## 系统架构

```
浏览器 ←→ HTTP Stream ←→ 内存Buffer ←→ Agent任务 ←→ 供应商(LLM)
                          ↓
                       数据库(持久化)
```

**说明**：
- 使用 HTTP Stream（基于 ReadableStream）而非 WebSocket
- 前端通过 `fetch` + `ReadableStream` 接收流式数据
- 后端通过 `NextResponse` 返回流式响应

## 数据结构

### 后端维护（每个conversation）
```typescript
interface ConversationBuffer {
  streamConversations: Record<string, string>;      // 完整的流式消息字符串
  lastMessageIndex: Record<string, number>;         // 上一个完整消息的结束位置
  lastStreamOutputIndex: Record<string, number>;    // 上一次前端读取的位置
}

// 使用示例
const buffer: ConversationBuffer = {
  streamConversations: {
    'conv_001': '[SYSTEM]...[/SYSTEM][USER]...[/USER]'
  },
  lastMessageIndex: { 'conv_001': 50 },
  lastStreamOutputIndex: { 'conv_001': 50 }
};
```

### 前端维护
```typescript
interface StreamState {
  streamMessages: string;        // 累积接收的消息字符串
  lastMessageIndex: number;      // 上一个完整消息的结束位置
  lastStreamOutputIndex: number; // 已渲染位置
}

// 使用示例
const state: StreamState = {
  streamMessages: '[SYSTEM]...[/SYSTEM][USER]...[/USER]',
  lastMessageIndex: 50,
  lastStreamOutputIndex: 50
};
```

## 消息流程

### 1. 特殊标记
```
[SYSTEM]...[/SYSTEM]     - 系统消息
[USER]...[/USER]         - 用户消息
[ASSISTANT]...[/ASSISTANT] - 助手消息
[TOOL]...[/TOOL]         - 工具调用
[MESSAGE_FINISHED]       - 单条消息完成
[AGENT_FINISHED]         - Agent任务完成
[AGENT_ERROR:...]        - Agent错误
```

### 2. 正常流程
1. 前端创建 Agent 任务
2. 后端初始化 `stream_conversations`，添加 system + user 消息
3. Agent 调用供应商，流式接收 response
4. 每个 token 累积到 `stream_conversations`
5. 检测到 `[MESSAGE_FINISHED]` 标记时，更新 `last_message_index` 并保存到 DB
6. 前端通过 WebSocket 只接收增量数据，累积到本地 `stream_messages`
7. Agent 完成后发送 `[AGENT_FINISHED]`

## 前后端交互

### 初始连接时
```
前端请求: GET /stream?conversation_id=conv_001
后端返回:
{
  "stream_messages": "当前累积的所有消息",
  "last_message_index": 300,
  "last_stream_output_index": 220,
  "current_length": 500
}
```

### 持续接收（HTTP Stream）
```typescript
// 后端返回流式响应，前端接收处理
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ messages, conversation_id }),
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  // 解析流式事件
  const lines = chunk.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      
      if (data.type === 'chunk') {
        // 接收 token
        streamMessages += data.content;
      } else if (data.type === 'message_finished') {
        // 消息完成
        lastMessageIndex = streamMessages.length;
      } else if (data.type === 'agent_finished') {
        // Agent 完成
        break;
      }
    }
  }
}
```

## 前端渲染逻辑

### 判断渲染模式
```typescript
// 后端数据结构
interface BufferState {
  streamConversations: Record<string, string>;
  lastMessageIndex: Record<string, number>;
  lastStreamOutputIndex: Record<string, number>;
}

// 前端数据结构
interface ClientState {
  streamMessages: string;
  lastMessageIndex: number;
  lastStreamOutputIndex: number;
}

// 判断是否需要快速渲染
const FAST_RENDER_THRESHOLD = 1000;
const accumulatedData = clientState.streamMessages.length - clientState.lastStreamOutputIndex;

if (accumulatedData > FAST_RENDER_THRESHOLD) {
  // 快速渲染模式：不控制速度，快速显示所有堆积数据
  const newData = clientState.streamMessages.slice(
    clientState.lastStreamOutputIndex + 1
  );
  
  for (const char of newData) {
    renderChar(char);  // 无延迟快速显示
  }
  
  clientState.lastStreamOutputIndex = clientState.streamMessages.length;
} else {
  // 流式渲染模式：逐个token缓慢显示（由WebSocket事件触发）
  // 每收到一个token事件就显示一个字符
  onChunkReceived((chunk) => {
    clientState.streamMessages += chunk;
    renderChar(chunk);
    clientState.lastStreamOutputIndex++;
  });
}
```

### 统一的消息转换
```typescript
// 前后端都采用相同逻辑
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  finished: boolean;
}

function parseMessages(streamString: string, fromIndex: number, toIndex: number): Message[] {
  const messages: Message[] = [];
  const section = streamString.slice(fromIndex, toIndex);
  
  // 查找完整消息边界
  const messageRegex = /\[(SYSTEM|USER|ASSISTANT|TOOL)\]([\s\S]*?)\[\/\1\](?:\[MESSAGE_FINISHED\])?/g;
  let match;
  
  while ((match = messageRegex.exec(section)) !== null) {
    const [fullMatch, role, content] = match;
    const isFinished = fullMatch.includes('[MESSAGE_FINISHED]');
    
    messages.push({
      role: role.toLowerCase() as any,
      content: content.trim(),
      finished: isFinished
    });
  }
  
  return messages;
}
```

## 中断恢复场景

### 场景A：正常流式输出
```
初始: stream_conversations="[SYSTEM]...[USER]..."
     last_message_index=-1, last_stream_output_index=73

生成中: stream_conversations="[SYSTEM]...[USER] Here's code"
      last_message_index=73, last_stream_output_index=100

消息完成: stream_conversations="[SYSTEM]...[USER]...[ASSISTANT]...[ASSISTANT_END]"
        last_message_index=200, last_stream_output_index=200
```

### 场景B：查看历史
```
后端从DB加载所有消息并拼接
last_stream_output_index=-1 (表示前端还未读)
前端判断有堆积 → 进入快速渲染模式 → 一次性显示所有历史
```

### 场景C：刷新网页重连
```
前次: last_stream_output_index=220
后端此时: stream_conversations在位置280

重连时:
前端收到 stream_messages 和 last_stream_output_index=220
判断: 280-220=60 < 1000 → 流式渲染模式
但会先发送 [220+1:280] 的堆积数据 → 快速渲染
然后切回流式渲染等待新数据
```

### 场景D：长时间离线后重连
```
离线前: last_stream_output_index=110
离线中: Agent 继续运行，stream_conversations 增长到 500

重连时:
堆积数据 = 500-110=390
判断: 390 < 1000 → 流式渲染模式
实际会先快速显示堆积部分，然后继续流式
```

## 关键特性

### ✓ 对称性
- 前后端维护相同的数据结构
- 前后端使用相同的消息解析逻辑
- 代码结构高度一致

### ✓ 简洁性
- 只用两个指针完全确定系统状态
- 无需维护消息版本
- 渲染模式自动切换

### ✓ 容错性
- 刷新不丢失数据
- 长时间离线可恢复
- 部分消息可显示（不等待完整）

### ✓ 效率
- 内存 Buffer 减少 DB 压力
- 完成消息才持久化
- 前端自决策渲染速度

## 实现要点

1. **特殊标记设计**
   - 使用 `[]` 包裹的标记，易于识别和解析
   - 标记之间不可嵌套

2. **Buffer 过期清理**
   - 设置过期时间（如 60 秒）
   - Agent 完成后立即持久化消息

3. **WebSocket 协议**
   - 使用 Server-Sent Events (SSE) 或自定义格式
   - 支持优雅退出和错误处理

4. **并发控制**
   - 每个 conversation 同时只允许一个 Agent 任务
   - 用锁或队列确保串行执行

## 流程图

```
创建Agent
    ↓
初始化Buffer
    ↓
前端连接WebSocket
    ↓
后端返回初始状态 ← ─ ─ ─ ─ ─ ─ 前端判断堆积 ← ─ ─ 快速/流式渲染
    ↓
Agent调用供应商
    ↓
流式接收Token ─ ─ → WebSocket推送 ← ─ ─ ─ 前端累积
    ↓
检测MESSAGE_FINISHED
    ↓
保存到DB，更新last_message_index
    ↓
继续或完成
    ↓
发送AGENT_FINISHED
    ↓
断开连接
```

## 总结

这是一个**对称、简洁、容错的流式架构**：
- 核心是两个指针管理状态
- 前后端逻辑完全镜像
- 自动处理中断和恢复
- 统一了流式和历史查看的代码
