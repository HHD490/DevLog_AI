"""
Agent Router
API endpoints for the Brain Agent
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import json

from services.agent import BrainAgent
from llm import get_llm

logger = logging.getLogger(__name__)
router = APIRouter()


class AskRequest(BaseModel):
    query: str
    conversation_history: List[Dict[str, str]] = []
    llm_provider: Optional[str] = None


class AskResponse(BaseModel):
    answer: str
    retrieved_logs: List[Dict[str, Any]]
    intent: Optional[Dict[str, Any]]


@router.post("/ask", response_model=AskResponse)
async def ask_brain(request: AskRequest):
    """
    Ask the Brain Agent a question.
    Uses multi-path retrieval: date filtering, tag filtering, semantic search.
    """
    try:
        llm = get_llm(request.llm_provider)
        agent = BrainAgent(llm=llm)
        
        result = await agent.run(
            query=request.query,
            conversation_history=request.conversation_history
        )
        
        return AskResponse(
            answer=result["answer"],
            retrieved_logs=result["retrieved_logs"],
            intent=result["intent"]
        )
    except Exception as e:
        logger.error(f"Agent error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class AskStreamRequest(BaseModel):
    query: str
    conversation_history: List[Dict[str, str]] = []
    llm_provider: Optional[str] = None


@router.post("/ask/stream")
async def ask_brain_stream(request: AskStreamRequest):
    """
    Ask the Brain Agent with streaming response.
    First retrieves relevant logs, then streams the answer.
    """
    try:
        llm = get_llm(request.llm_provider)
        agent = BrainAgent(llm=llm)
        
        # Run retrieval first (non-streaming)
        initial_state = {
            "query": request.query,
            "conversation_history": request.conversation_history,
            "intent": None,
            "retrieved_logs": [],
            "answer": ""
        }
        
        # Parse intent and retrieve
        state = await agent._parse_intent(initial_state)
        state = await agent._retrieve_logs(state)
        
        # Stream the answer generation
        async def event_generator():
            # First send metadata
            yield f"data: {json.dumps({'type': 'metadata', 'intent': state['intent'], 'log_count': len(state['retrieved_logs'])})}\n\n"
            
            # Generate answer with streaming
            from datetime import datetime
            
            def format_date(ts: int) -> str:
                return datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d")
            
            context = "\n".join(
                f"[{format_date(log['timestamp'])}] {log['content']}"
                for log in state["retrieved_logs"][:15]
            )
            
            history = ""
            if request.conversation_history:
                history = "\n\n".join(
                    f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
                    for m in request.conversation_history[-10:]
                )
                history = f"\n=== CONVERSATION HISTORY ===\n{history}\n"
            
            prompt = f"""You are a helpful AI assistant that knows my work history.

=== MY WORK LOGS ===
{context if context else "(No relevant logs found)"}
{history}
=== CURRENT QUESTION ===
{request.query}

Provide a helpful, conversational response."""

            async for chunk in llm.generate_stream(prompt):
                yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"
            
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream"
        )
    except Exception as e:
        logger.error(f"Agent stream error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def agent_health():
    """Check agent service health."""
    try:
        from services.database import get_all_logs
        log_count = len(get_all_logs(limit=1))
        llm_name = get_llm().name
        
        return {
            "status": "ok",
            "llm_provider": llm_name,
            "database_connected": log_count >= 0
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }
