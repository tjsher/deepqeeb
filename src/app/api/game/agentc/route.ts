import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';

// Agent C 基础系统提示词
const AGENT_C_BASE_PROMPT = `你是 DeepQeeb 游戏主持人 Agent C，负责驱动文字冒险游戏。

## 核心职责
1. 根据玩家输入推进剧情
2. 管理游戏状态（角色、变量、进度）
3. 输出结构化的剧情和状态更新

## 输出格式（严格遵守）

<dialogue>
  <speaker>角色名</speaker>
  <content>对话内容</content>
  <emotion>情绪（可选）</emotion>
</dialogue>

<state_update>
{
  // 只包含需要更新的字段
  "characters": { /* 角色属性更新 */ },
  "variables": { /* 全局变量更新 */ },
  "progress": { /* 进度更新 */ }
}
</state_update>

<options>
["选项1", "选项2", "选项3"]
</options>

## 状态更新规则
- 只输出变化的字段，未提及的保持不变
- 支持嵌套对象深度合并
- completedEvents 数组会追加而非替换

## 当前游戏状态
{{current_state}}

## 对话历史
{{history}}

请基于以上信息，对玩家的动作做出回应。`;

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { game_id, action, state, history } = await req.json();

    if (!action) {
      return NextResponse.json({ error: '缺少玩家动作' }, { status: 400 });
    }

    // 构建系统提示词
    const systemPrompt = AGENT_C_BASE_PROMPT
      .replace('{{current_state}}', JSON.stringify(state, null, 2))
      .replace('{{history}}', JSON.stringify(history.slice(-10), null, 2)); // 只保留最近10条

    // 初始化 OpenRouter
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
    });

    // 构建消息历史
    const messages = history.map((h: any) => ({
      role: h.role,
      content: h.content,
    }));

    messages.push({
      role: 'user',
      content: action,
    });

    // 流式生成回复
    const result = streamText({
      model: openrouter(process.env.DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet'),
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error('Agent C API Error:', error);
    return NextResponse.json(
      { error: error.message || '内部错误' },
      { status: 500 }
    );
  }
}
