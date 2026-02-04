import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText } from 'ai';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 允许流式响应最长 60 秒
export const maxDuration = 60;

// Agent A 系统提示词 - 剧本创作
const AGENT_A_SYSTEM_PROMPT = `你是 DeepQeeb 的剧本创作助手 Agent A。

你的职责：
1. 帮助用户创作文字冒险游戏的剧本
2. 设计角色、剧情分支、世界观
3. 将创作内容整理成规范的文件格式

输出规范：
- 使用 Markdown 格式输出剧本内容
- 角色设定使用表格形式
- 剧情分支使用流程图描述或列表
- 对话内容使用引号标注说话人

当用户要求生成游戏时，你会切换到 Agent B 模式。`;

// Agent B 系统提示词 - 游戏生成
const AGENT_B_SYSTEM_PROMPT = `你是 DeepQeeb 的游戏生成助手 Agent B。

你的职责：
1. 读取用户提供的剧本
2. 生成可运行的 HTML/ESM 游戏代码
3. 设计美观的 UI 界面
4. 嵌入 Agent C 的运行时配置

技术规范：
- 使用原生 ESM 模块
- 通过 esm.sh 加载 React、Tailwind
- 使用 iframe + srcdoc 安全沙箱
- 输出完整的单文件 HTML

游戏代码必须包含：
1. 剧本解析器
2. 状态管理系统
3. Agent C 通信协议
4. UI 渲染引擎`;

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            cookie: cookieStore.toString(),
          },
        },
      }
    );
    
    // 验证用户
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { messages, conversation_id } = await req.json();

    // 获取对话信息
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .eq('user_id', session.user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: '对话不存在' }, { status: 404 });
    }

    // 根据对话类型选择 Agent
    const systemPrompt = conversation.type === 'script' 
      ? AGENT_A_SYSTEM_PROMPT 
      : AGENT_B_SYSTEM_PROMPT;

    // 初始化 OpenRouter
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
    });

    // 流式生成回复
    const result = streamText({
      model: openrouter(process.env.DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet'),
      system: systemPrompt,
      messages,
      async onFinish({ text }) {
        // 保存消息到数据库
        await supabase.from('messages').insert({
          conversation_id,
          role: 'assistant',
          content: text,
          metadata: {
            type: 'normal',
          },
        });
      },
    });

    // 保存用户消息
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage?.role === 'user') {
      await supabase.from('messages').insert({
        conversation_id,
        role: 'user',
        content: lastUserMessage.content,
      });
    }

    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error.message || '内部错误' },
      { status: 500 }
    );
  }
}
