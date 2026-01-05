"""
DevLog AI Backend
FastAPI application with Embedding, AI, and Agent services
"""

import logging
import sys
from pathlib import Path

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import config first to load environment variables
from config import settings

# Import routers
from routers import embedding, ai, agent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="DevLog AI Backend",
    description="""
    Backend services for DevLog AI application.
    
    ## Services
    
    - **Embedding**: Text embedding using BGE-M3 model
    - **AI**: Tag extraction, summaries, blog generation, skill analysis
    - **Agent**: Intelligent Q&A with multi-path retrieval (LangGraph)
    
    ## Authentication
    
    No authentication required for local development.
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(embedding.router, prefix="/embed", tags=["Embedding"])
app.include_router(ai.router, prefix="/ai", tags=["AI Services"])
app.include_router(agent.router, prefix="/agent", tags=["Agent"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    from llm.factory import get_current_provider_name
    
    # Check if embedding model is loaded
    try:
        from services.embedding import get_model, _model
        model_loaded = _model is not None
    except:
        model_loaded = False
    
    # Check database
    try:
        from services.database import get_all_logs
        db_logs = len(get_all_logs(limit=1))
        db_connected = True
    except:
        db_connected = False
    
    return {
        "status": "ok",
        "services": {
            "embedding": {"model_loaded": model_loaded},
            "ai": {"llm_provider": get_current_provider_name()},
            "agent": {"available": True},
            "database": {"connected": db_connected}
        }
    }


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "name": "DevLog AI Backend",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT
    )
