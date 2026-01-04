# DevLog AI

一个智能开发日志管理应用，帮助开发者记录、追踪和回顾编程学习与开发历程。

## ✨ 功能特性

### 📝 日志管理
- **快速记录**: 支持 Markdown 语法的开发日志
- **自动标签**: AI 自动识别技术标签（语言、框架、工具等）
- **时间线视图**: 按日期查看所有日志记录
- **日历热力图**: 可视化展示开发活动频率

### 🧠 AI 智能功能
- **Ask Brain**: 基于所有日志的智能问答，支持多轮对话
- **每日回顾**: AI 自动生成每日开发总结
- **博客生成**: 根据日志自动生成技术博客文章
- **多 AI 提供商**: 支持 Google Gemini、OpenAI、Anthropic

### 🔗 知识图谱
- **语义关联**: 使用 BGE-M3 模型计算日志间的语义相似度
- **可视化网络**: 力导向图展示日志之间的关系
- **相似度过滤**: 可调节阈值筛选关联强度

### 🔄 GitHub 集成
- **自动同步**: 获取 GitHub commit 信息
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
- Google Gemini / OpenAI / Anthropic API
- Python FastAPI (Embedding 服务)
- BGE-M3 (语义嵌入模型)

## 📦 部署指南

### 环境要求

- Node.js >= 18
- Python >= 3.10
- [uv](https://docs.astral.sh/uv/) (Python 包管理器)

### 1. 安装 Node.js 依赖

```bash
git clone https://github.com/yourusername/devlog-ai.git
cd devlog-ai
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```env
# AI Provider (选择一个)
GEMINI_API_KEY=your_gemini_api_key

# 可选: 其他 AI 提供商
# OPENAI_API_KEY=your_openai_api_key
# ANTHROPIC_API_KEY=your_anthropic_api_key

# 可选: GitHub 集成
# GITHUB_TOKEN=your_github_token
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

**启动主应用 (前端 + 后端):**

```bash
npm run dev
```

**启动 Embedding 服务 (可选):**

```bash
cd embedding-service
uv run python main.py
```

应用将在 http://localhost:5173 运行。

### 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 5173 | Vite 开发服务器 |
| 后端 | 3001 | Express API 服务器 |
| Embedding | 5001 | Python FastAPI 服务 |

## 📁 项目结构

```
devlog-ai/
├── components/          # React 组件
├── server/              # Node.js 后端
│   ├── routes/          # API 路由
│   ├── services/        # 业务逻辑
│   └── db/              # 数据库配置
├── embedding-service/   # Python Embedding 服务
│   ├── main.py          # FastAPI 应用
│   └── pyproject.toml   # Python 依赖
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

## 📄 License

MIT
