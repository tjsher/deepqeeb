import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { tool, ToolLoopAgent, createAgentUIStreamResponse, stepCountIs } from 'ai';
import { createClient } from '@/lib/supabase-server';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

// ==================== System Prompts ====================

const BASE_SYSTEM_PROMPT = `你是 DeepQeeb 的智能辅助。你的目标是协助用户完成文字游戏剧本创作或游戏生成。

你拥有一系列【技能(Skills)】，这些技能定义了你的专业职责和工作标准。
在开始工作前，请务必先使用 'read_skills' 工具列出并阅读相关技能内容。

## 核心原则：
1. **文件驱动**：所有创作内容必须体现在剧本项目的文件系统中。
2. **提议模式**：当你修改已有文件时，请使用 'propose_file_edit' 提交更改，用户将审核 Diff。
3. **技能导向**：根据当前的 agent_mode (script/game)，读取并严格遵守对应的技能文档。
4. **即时反馈**：在执行文件操作时，请在对话中简要解释你做了什么或接下来需要用户做什么。不要保持沉默。

当前模式：{{agent_mode}}
`;

const PROMPT_MAP: Record<string, string> = {
  script: '你当前担任【剧本编剧】角色。请阅读 "script-writer" 技能并遵照其标准工作。',
  game: '你当前担任【游戏导演】角色。请阅读 "game-developer" 技能并遵照其标准工作。'
};

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // 1. Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, conversation_id, script_id, agent_mode } = await req.json();

    console.log('--- Chat Request ---');
    console.log('conversation_id:', conversation_id);
    console.log('script_id:', script_id);
    console.log('agent_mode:', agent_mode);

    if (!script_id) {
      return NextResponse.json({ error: 'Missing script_id' }, { status: 400 });
    }

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL,
    });

    // 2. Define Agent
    const agent = new ToolLoopAgent({
      model: openrouter(process.env.DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet'),
      instructions: BASE_SYSTEM_PROMPT.replace('{{agent_mode}}', agent_mode) + '\n' + (PROMPT_MAP[agent_mode] || ''),
      tools: {
        list_files: tool({
          description: '列出当前剧本项目的代码和文件夹。',
          parameters: z.object({
            directory: z.string().optional().describe('要列出的目录。默认为根目录 "/"')
          }),
          // @ts-ignore
          execute: async ({ directory = '/' }: { directory?: string }) => {
            const { data, error } = await supabase
              .from('files')
              .select('path, type, name')
              .eq('script_id', script_id);

            if (error) return `Error listing files: ${error.message}`;
            if (!data || data.length === 0) return 'No files found in this script.';

            const cleanDir = directory.endsWith('/') ? directory : directory + '/';
            const filtered = data.filter(f => {
              if (directory === '/') {
                const relative = f.path.startsWith('/') ? f.path.substring(1) : f.path;
                return !relative.includes('/');
              }
              if (!f.path.startsWith(cleanDir)) return false;
              const relative = f.path.substring(cleanDir.length);
              return !relative.includes('/') && relative.length > 0;
            });

            return filtered.map(f => `[${f.type.toUpperCase()}] ${f.path}`).join('\n');
          },
        }),
        read_file: tool({
          description: '读取剧本项目中特定文件的内容。',
          parameters: z.object({
            path: z.string().describe('文件绝对路径，例如 "/剧本/01-故事线.md"')
          }),
          // @ts-ignore
          execute: async ({ path }: { path: string }) => {
            const { data, error } = await supabase
              .from('files')
              .select('content')
              .eq('script_id', script_id)
              .eq('path', path)
              .single();

            if (error) return `Error reading file: ${error.message}`;
            return data?.content || '(空文件)';
          },
        }),
        propose_file_edit: tool({
          description: '对已有文件提议修改。这将向用户展示 Diff，用户可选择接受或拒绝。',
          parameters: z.object({
            path: z.string().describe('要修改的文件路径。'),
            new_content: z.string().describe('文件的新完整内容。')
          }),
          // @ts-ignore
          execute: async ({ path, new_content }: { path: string, new_content: string }) => {
            const { error } = await supabase
              .from('files')
              .update({ pending_content: new_content })
              .eq('script_id', script_id)
              .eq('path', path);

            if (error) return `Error proposing edit: ${error.message}`;
            return `已提交对 ${path} 的修改建议。用户将在界面上看到差异对比并决定是否应用。`;
          },
        }),
        create_file: tool({
          description: '在剧本项目中创建一个新文件（目前仅限 .md 或代码文件）。',
          parameters: z.object({
            path: z.string().describe('绝对路径，例如 "/剧本/新人物.md"'),
            content: z.string().optional().describe('文件的初始内容。')
          }),
          // @ts-ignore
          execute: async ({ path, content = '' }: { path: string, content?: string }) => {
            const name = path.split('/').pop() || 'file';
            const { error } = await supabase
              .from('files')
              .upsert({
                script_id: script_id,
                path,
                name,
                type: 'file',
                content
              });

            if (error) return `Error creating file: ${error.message}`;
            return `成功创建文件: ${path}`;
          },
        }),
        create_folder: tool({
          description: '在剧本项目中创建一个新文件夹。',
          parameters: z.object({
            path: z.string().describe('绝对路径，例如 "/剧本/场景"')
          }),
          // @ts-ignore
          execute: async ({ path }: { path: string }) => {
            const name = path.split('/').pop() || 'folder';
            const { error } = await supabase
              .from('files')
              .insert({
                script_id: script_id,
                path,
                name,
                type: 'folder'
              });

            if (error) return `Error creating folder: ${error.message}`;
            return `成功创建文件夹: ${path}`;
          },
        }),
        read_skills: tool({
          description: '从知识库读取可用技能。当你不知道该做什么或怎么做时，请先阅读此项。',
          parameters: z.object({
            skill_name: z.string().optional().describe('技能名称（英文，如 "script-writer"）。如果省略，则列出所有技能及其描述。')
          }),
          // @ts-ignore
          execute: async ({ skill_name }: { skill_name?: string }) => {
            try {
              const fs = require('fs');
              const path = require('path');
              const skillsDir = path.join(process.cwd(), 'skills');

              if (!fs.existsSync(skillsDir)) return '技能目录不存在。';

              if (skill_name) {
                const filePath = path.join(skillsDir, `${skill_name}.md`);
                if (fs.existsSync(filePath)) {
                  return fs.readFileSync(filePath, 'utf8');
                }
                return `未找到技能 "${skill_name}"。你可以尝试列出所有技能查看可用项。`;
              } else {
                const files = fs.readdirSync(skillsDir).filter((f: string) => f.endsWith('.md'));
                const summaries = files.map((f: string) => {
                  const content = fs.readFileSync(path.join(skillsDir, f), 'utf8');
                  // 提取 Frontmatter (--- ... ---)
                  const match = content.match(/^---\n([\s\S]*?)\n---/);
                  const metadata = match ? match[1] : 'No metadata found';
                  return `文件名: ${f.replace('.md', '')}\n元数据:\n${metadata}\n---`;
                });
                return `可用技能列表及说明：\n\n${summaries.join('\n\n')}`;
              }
            } catch (e: any) {
              return `读取技能失败: ${e.message}`;
            }
          },
        }),
        search_files: tool({
          description: '在剧本项目中通过名称或内容搜索文件。',
          parameters: z.object({
            query: z.string().describe('搜索关键词')
          }),
          // @ts-ignore
          execute: async ({ query }: { query: string }) => {
            const { data, error } = await supabase
              .from('files')
              .select('path, type')
              .eq('script_id', script_id)
              .or(`path.ilike.%${query}%,content.ilike.%${query}%`);

            if (error) return `Error searching files: ${error.message}`;
            if (!data || data.length === 0) return '未找到匹配的文件。';

            return data.map(f => `[${f.type.toUpperCase()}] ${f.path}`).join('\n');
          },
        })
      },
      stopWhen: stepCountIs(20),
      onStepFinish: ({ toolCalls }) => {
        if (toolCalls?.length) {
          console.log(`--- Step Finished: Called ${toolCalls.length} tools ---`);
        }
      }
    });

    // 3. Respond with UI Stream
    return createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
      // @ts-ignore - Argument has 'messages' property according to linting
      async onFinish({ messages: streamMessages }) {
        console.log('--- Agent Loop Finished ---');
        const lastAssistantMsg = [...streamMessages].reverse().find(m => m.role === 'assistant');

        if (lastAssistantMsg) {
          const content = (lastAssistantMsg as any).content || '';
          const toolCalls = (lastAssistantMsg as any).toolCalls || [];

          console.log('Final text length:', content.length);

          const { error: insertError } = await supabase.from('messages').insert({
            conversation_id,
            role: 'assistant',
            content: content,
            metadata: {
              agent_mode,
              tool_calls: toolCalls,
            },
          });

          if (insertError) {
            console.error('Error saving message:', insertError);
          } else {
            console.log('Assistant message saved.');
          }
        }
      },
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
