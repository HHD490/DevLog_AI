"""
AI Services Router
API endpoints for AI operations (tags, summaries, blogs, skills)
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import logging
import json

from services.tag_extraction import process_entry, batch_process_entries, Tag, TagExtractionResult
from services.daily_summary import generate_daily_summary, LogEntry as SummaryLogEntry
from services.blog_generator import generate_blog, LogEntry as BlogLogEntry
from services.skill_tree import analyze_for_skill_tree, LogEntry as SkillLogEntry, SummaryEntry, ExistingSkill
from services.ai_utils import generate_conversation_title
from llm import get_llm

logger = logging.getLogger(__name__)
router = APIRouter()


# === Tag Extraction ===

class TagRequest(BaseModel):
    text: str


class TagResponse(BaseModel):
    tags: List[Tag]
    summary: str


class BatchTagRequest(BaseModel):
    entries: List[dict]  # [{"id": "...", "content": "..."}]


class BatchTagResponse(BaseModel):
    results: dict  # {id: {tags, summary}}


@router.post("/tags", response_model=TagResponse)
async def extract_tags(request: TagRequest):
    """Extract tags and summary from text."""
    try:
        result = await process_entry(request.text)
        return TagResponse(tags=result.tags, summary=result.summary)
    except Exception as e:
        logger.error(f"Tag extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tags/batch", response_model=BatchTagResponse)
async def extract_tags_batch(request: BatchTagRequest):
    """Batch extract tags from multiple entries."""
    try:
        results = await batch_process_entries(request.entries)
        # Convert to serializable format
        serialized = {
            k: {"tags": [t.model_dump() for t in v.tags], "summary": v.summary}
            for k, v in results.items()
        }
        return BatchTagResponse(results=serialized)
    except Exception as e:
        logger.error(f"Batch tag extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Daily Summary ===

class SummaryRequest(BaseModel):
    date: str
    logs: List[dict]  # [{"timestamp": int, "content": str, "source": str}]


class SummaryResponse(BaseModel):
    date: str
    content: str
    key_achievements: List[str]
    tech_stack_used: List[str]


@router.post("/summary", response_model=SummaryResponse)
async def create_summary(request: SummaryRequest):
    """Generate daily summary."""
    try:
        logs = [SummaryLogEntry(**log) for log in request.logs]
        result = await generate_daily_summary(request.date, logs)
        return SummaryResponse(
            date=result.date,
            content=result.content,
            key_achievements=result.key_achievements,
            tech_stack_used=result.tech_stack_used
        )
    except Exception as e:
        logger.error(f"Summary generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Blog Generator ===

class BlogRequest(BaseModel):
    logs: List[dict]  # [{"timestamp": int, "content": str}]
    period_name: str


class BlogResponse(BaseModel):
    title: str
    content: str


@router.post("/blog", response_model=BlogResponse)
async def create_blog(request: BlogRequest):
    """Generate blog post."""
    try:
        logs = [BlogLogEntry(**log) for log in request.logs]
        result = await generate_blog(logs, request.period_name)
        return BlogResponse(title=result.title, content=result.content)
    except Exception as e:
        logger.error(f"Blog generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Skill Tree ===

class SkillTreeRequest(BaseModel):
    new_logs: List[dict]
    new_summaries: List[dict]
    existing_skill_tree: List[dict]


class SkillTreeResponse(BaseModel):
    skills: List[dict]


@router.post("/skills", response_model=SkillTreeResponse)
async def analyze_skills(request: SkillTreeRequest):
    """Analyze logs for skill tree updates."""
    try:
        new_logs = [SkillLogEntry(**log) for log in request.new_logs]
        new_summaries = [SummaryEntry(**s) for s in request.new_summaries]
        existing = [ExistingSkill(**s) for s in request.existing_skill_tree]
        
        skills = await analyze_for_skill_tree(new_logs, new_summaries, existing)
        return SkillTreeResponse(skills=[s.model_dump() for s in skills])
    except Exception as e:
        logger.error(f"Skill analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Utility ===

class TitleRequest(BaseModel):
    message: str


class TitleResponse(BaseModel):
    title: str


@router.post("/title", response_model=TitleResponse)
async def create_title(request: TitleRequest):
    """Generate conversation title."""
    try:
        title = await generate_conversation_title(request.message)
        return TitleResponse(title=title)
    except Exception as e:
        logger.error(f"Title generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Streaming Generate ===

class GenerateRequest(BaseModel):
    prompt: str
    provider: Optional[str] = None


@router.post("/generate")
async def generate_text(request: GenerateRequest):
    """Generate text with optional streaming."""
    try:
        llm = get_llm(request.provider)
        response = await llm.generate(request.prompt)
        return {"response": response}
    except Exception as e:
        logger.error(f"Generate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/stream")
async def generate_text_stream(request: GenerateRequest):
    """Generate text with SSE streaming."""
    try:
        llm = get_llm(request.provider)
        
        async def event_generator():
            async for chunk in llm.generate_stream(request.prompt):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream"
        )
    except Exception as e:
        logger.error(f"Stream generate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
