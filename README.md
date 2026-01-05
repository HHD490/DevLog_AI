# DevLog AI
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](https://github.com/HHD490/DevLog_AI/blob/main/LICENSE)
[![README-en](https://img.shields.io/badge/README-en-brightgreen)](https://github.com/HHD490/DevLog_AI/blob/main/README-EN.md)

一个智能开发日志管理应用，帮助开发者记录、追踪和回顾编程学习与开发历程。

## ✨ 功能特性

### 📝 日志管理
- **快速记录**: 支持 Markdown 语法的开发日志
- **自动标签**: AI 自动识别技术标签（语言、框架、工具等）
- **时间线视图**: 按日期查看所有日志记录
- **日历热力图**: 可视化展示开发活动频率

### 🧠 AI 智能功能
- **Ask Brain**: 基于所有日志的智能问答，支持多轮对话
- **每日回顾**: AI 自动生成每日开发总结（每天晚上23:45，可手动生成）
- **博客生成**: 根据日志自动生成技术博客文章
- **技能树**: AI 自动识别技术标签（语言、框架、工具等）并生成技能树
- **多 AI 提供商**: 支持 Google Gemini、DeepSeek（后续拓展其他提供商）

### 🔗 知识图谱
- **语义关联**: 使用 BGE-M3 模型计算日志间的语义相似度
- **可视化网络**: 力导向图展示日志之间的关系
- **相似度过滤**: 可调节阈值筛选关联强度

### 🔄 GitHub 集成
- **自动同步**: 获取 GitHub commit 信息（每天晚上23:43，可手动拉取）
- **活动整合**: 将代码提交与开发日志关联

## 🛠️ 技术栈

**前端**
- React 18 + TypeScript
- Vite
- TailwindCSS
- Canvas (知识图谱可视化)

**后端**
- Node.js + Express
- SQLite + Drizzle ORM
- node-cron (定时任务)

**AI/ML**
- Google Gemini / DeepSeek
- Python FastAPI (Embedding 服务)
- BGE-M3 (语义嵌入模型)

## 📦 部署指南

### 环境要求

- Node.js >= 18
- Python >= 3.10
- [uv](https://docs.astral.sh/uv/) (Python 包管理器)

### 1. 安装 Node.js 依赖

```bash
git clone https://github.com/HHD490/DevLog_AI.git
cd DevLog_AI
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件（将 `.env.example` 重命名为 `.env.local`即可）：

```env
# AI Provider (选择一个)
GEMINI_API_KEY=your_gemini_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
# 可选: 其他 AI 提供商（暂时还没添加）
# OPENAI_API_KEY=your_openai_api_key
# ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 3. 初始化数据库

```bash
npx drizzle-kit push
```

### 4. 安装 Embedding 服务 (可选，用于知识图谱)

```bash
cd embedding-service

# 使用 uv 创建虚拟环境并安装依赖
uv venv
uv sync
```

### 5. 启动应用

**启动主应用 (前端 + Node.js 后端):**

```bash
npm run dev
```

**启动 Python 后端服务 (AI + Embedding):**

```bash
cd backend
uv run python main.py
```

应用将在 http://localhost:3000 运行。

### 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 3000 | Vite 开发服务器 |
| Node.js 后端 | 3001 | Express API 服务器 |
| Python 后端 | 5001 | FastAPI (AI + Embedding) |

## 📁 项目结构

```
devlog-ai/
├── components/          # React 组件
├── server/              # Node.js 后端 (API 路由、数据库)
│   ├── routes/          # API 路由
│   ├── services/        # 业务逻辑
│   └── db/              # 数据库配置
├── backend/             # Python 后端 (AI + Agent)
│   ├── main.py          # FastAPI 应用入口
│   ├── llm/             # LLM 提供商抽象层
│   ├── services/        # AI 服务 (标签、摘要、博客、Agent)
│   └── routers/         # FastAPI 路由
└── data/                # SQLite 数据库文件
```

## 🔧 开发

```bash
# 开发模式
npm run dev

# 类型检查
npm run typecheck

# 构建生产版本
npm run build
```

