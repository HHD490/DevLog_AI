# DevLog AI
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](https://github.com/HHD490/DevLog_AI/blob/main/LICENSE)

An intelligent development log management application designed to help developers record, track, and review their programming learning and development journey.

## ✨ Features

### 📝 Log Management
- **Quick Recording**: Support for Markdown-based development logs.
- **Auto Tagging**: AI automatically identifies technical tags (languages, frameworks, tools, etc.).
- **Timeline View**: Browse all log entries by date.
- **Calendar Heatmap**: Visualize the frequency of your development activities.

### 🧠 AI Smart Features
- **Ask Brain**: Intelligent Q&A based on all your logs, supporting multi-turn conversations.
- **Daily Review**: AI automatically generates a daily summary (every night at 23:45, or manual generation).
- **Blog Generation**: Automatically transform logs into technical blog posts.
- **Skill Tree**: AI identifies technical tags to generate a personalized skill tree.
- **Multi-AI Providers**: Supports Google Gemini, DeepSeek (more providers coming soon).

### 🔗 Knowledge Graph
- **Semantic Association**: Uses the BGE-M3 model to calculate semantic similarity between logs.
- **Visual Network**: A force-directed graph displaying relationships between logs.
- **Similarity Filtering**: Adjustable thresholds to filter association strength.

### 🔄 GitHub Integration
- **Auto Sync**: Fetch GitHub commit information (every night at 23:43, or manual fetch).
- **Activity Integration**: Link your code commits directly with your development logs.

## 🛠️ Tech Stack

**Frontend**
- React 18 + TypeScript
- Vite
- TailwindCSS
- Canvas (Knowledge Graph Visualization)

**Backend**
- Node.js + Express
- SQLite + Drizzle ORM
- node-cron (Scheduled Tasks)

**AI/ML**
- Google Gemini / DeepSeek
- Python FastAPI (Embedding Service)
- BGE-M3 (Semantic Embedding Model)

## 📦 Deployment Guide

### Prerequisites

- Node.js >= 18
- Python >= 3.10
- [uv](https://docs.astral.sh/uv/) (Python package manager)

### 1. Install Node.js Dependencies

```bash
git clone [https://github.com/HHD490/DevLog_AI.git](https://github.com/HHD490/DevLog_AI.git)
cd DevLog_AI
npm install
```

### 2. Configure Environment Variables
Create a .env.local file:

```env
# AI Provider (Choose one)
GEMINI_API_KEY=your_gemini_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
# Optional: Other providers coming soon
# OPENAI_API_KEY=your_openai_api_key
# ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 3. Initialize Database

```bash
npx drizzle-kit push
```

### 4. Install Embedding Service (Optional, for Knowledge Graph)

```bash
cd embedding-service

# Create virtual environment and install dependencies using uv
uv venv
uv sync
```

### 5. Start Application

Start Main App (Frontend + Backend):

```bash
npm run dev
```

Start Embedding Service (Optional):

```bash
cd embedding-service
uv run python main.py
```

The app will be running at http://localhost:5173.

### Port Mapping

| Service | Port | Description |
|------|------|------|
| Frontend | 5173 | Vite development server |
| Backend | 3001 | Express API server |
| Embedding | 5001 | Python FastAPI service |

## 📁 Project Structure

```
devlog-ai/
├── components/          # React components
├── server/              # Node.js backend
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   └── db/              # Database configuration
├── embedding-service/   # Python Embedding service
│   ├── main.py          # FastAPI application
│   └── pyproject.toml   # Python dependencies
└── data/                # SQLite database files
```

## 🔧 Development

```bash
# Development mode
npm run dev

# Type check
npm run typecheck

# Build for production
npm run build
```