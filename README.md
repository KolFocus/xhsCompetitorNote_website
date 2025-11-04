# 小红书竞品笔记监控系统

基于 Next.js (App Router) + antd + Supabase 的全栈Web应用。

## 功能特性

- ✅ 用户认证（登录/注册，基于Supabase Auth）
- ✅ 响应式后台管理系统布局
- ✅ 可收起的侧边栏菜单（支持二级菜单）
- ✅ 路由保护中间件
- ✅ TypeScript类型安全

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件（注意：`.env.local` 文件已在 `.gitignore` 中，不会提交到版本库）：

```env
NEXT_PUBLIC_SUPABASE_URL=https://plvjtbzwbxmajnkanhbe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsdmp0Ynp3YnhtYWpua2FuaGJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzODE4NjUsImV4cCI6MjA3NTk1Nzg2NX0.oQVOyp-dGdUqctn6dfvhWnFp2TUDOwY_y0M5_vl9e7U
GEMINI_API_KEY=your_gemini_api_key_here
```

**重要提示**: 
- `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是必需的，否则应用无法正常运行
- `GEMINI_API_KEY` 用于AI分析功能，可以稍后配置

### 3. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 4. 构建生产版本

```bash
npm run build
npm start
```

## 项目结构

```
/
├── app/                    # Next.js App Router 页面
│   ├── (auth)/            # 认证相关路由组
│   │   └── login/         # 登录页面（Tab切换登录/注册）
│   ├── (dashboard)/       # 主应用路由组
│   │   ├── layout.tsx     # 主应用布局
│   │   ├── page.tsx       # 首页
│   │   ├── notes/         # 笔记管理
│   │   ├── brands/        # 品牌管理
│   │   ├── reports/        # 分析报告
│   │   └── settings/       # 设置
│   └── layout.tsx         # 根布局
├── components/            # 可复用组件
│   └── layout/            # 布局相关组件
│       └── SidebarMenu.tsx # 侧边栏菜单
├── lib/                   # 工具函数和配置
│   ├── supabase/          # Supabase客户端
│   ├── utils/             # 工具函数
│   └── types/             # 类型定义
├── middleware.ts          # Next.js中间件（路由保护）
└── .项目文档/             # 项目文档目录
```

## 技术栈

- **前端框架**: Next.js 14+ (App Router)
- **UI组件库**: antd 5.x
- **数据库**: Supabase PostgreSQL
- **认证**: Supabase Auth
- **语言**: TypeScript
- **部署**: Vercel

## 开发规范

详细开发规范请参考 `.项目文档/03_技术实现/02_代码规范.md`

## 文档

项目文档位于 `.项目文档/` 目录下，包括：

- 项目说明
- 产品定义
- 技术实现方案
- 代码规范

## 许可证

MIT
