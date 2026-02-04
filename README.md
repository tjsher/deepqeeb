# DeepQeeb

基于 Next.js 15 + AI SDK 的对话式游戏开发平台。

## 技术栈

- **框架**: Next.js 15 (App Router) + React 19 + TypeScript
- **样式**: Tailwind CSS v4
- **AI**: Vercel AI SDK + OpenRouter (Claude/Gemini)
- **数据库**: Supabase
- **动画**: Framer Motion
- **部署**: Vercel

## 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local 填入你的 API Key

# 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 访问。

## 部署到 Vercel

### 方式一：CLI 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

### 方式二：Git 集成

将代码推送到 GitHub/GitLab，在 [Vercel Dashboard](https://vercel.com/dashboard) 导入仓库即可实现自动部署。

## 环境变量

在 Vercel Dashboard 的 Project Settings → Environment Variables 中设置：

| 变量名 | 说明 |
|--------|------|
| `OPENROUTER_API_KEY` | OpenRouter API Key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务角色 Key |

## 项目结构

```
app/
├── api/          # API 路由
├── page.tsx      # 主页面
└── layout.tsx    # 根布局
public/           # 静态资源
```

## 了解更多

- [Next.js 文档](https://nextjs.org/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [OpenRouter](https://openrouter.ai/docs)
