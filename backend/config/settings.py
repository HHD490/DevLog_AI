"""
Configuration settings for DevLog AI Backend
Loads environment variables from root .env.local
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env.local from project root
ROOT_DIR = Path(__file__).parent.parent.parent
ENV_FILE = ROOT_DIR / ".env.local"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)

# Database
DATABASE_PATH = ROOT_DIR / "data" / "devlog.db"

# LLM Configuration
AI_PROVIDER = os.getenv("AI_PROVIDER", "deepseek")  # deepseek, gemini, openai
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Embedding Configuration
EMBEDDING_MODEL = "BAAI/bge-m3"
MAX_TOKENS = 8192
CHUNK_OVERLAP = 128

# Server Configuration
HOST = "0.0.0.0"
PORT = 5001
