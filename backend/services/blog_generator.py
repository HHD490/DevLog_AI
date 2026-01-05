"""
Blog Generator Service
Generates technical blog posts from work logs
"""

import logging
from datetime import datetime
from typing import List
from pydantic import BaseModel

from llm import get_llm

logger = logging.getLogger(__name__)


class BlogPost(BaseModel):
    title: str
    content: str


class LogEntry(BaseModel):
    timestamp: int
    content: str


async def generate_blog(logs: List[LogEntry], period_name: str) -> BlogPost:
    """
    Generate a blog post from a range of logs.
    
    Args:
        logs: List of log entries
        period_name: Human-readable period name (e.g., "January 2026", "Week 1")
    """
    llm = get_llm()
    
    def format_date(ts: int) -> str:
        return datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d")
    
    context = "\n".join(
        f"[{format_date(l.timestamp)}] {l.content}" for l in logs
    )
    
    prompt = f"""Write a high-quality, engaging technical blog post summarizing my work for: {period_name}.
      
Raw Logs:
{context}

Guidelines:
1. Title should be catchy.
2. Content should be in Markdown.
3. Group related tasks into sections (e.g., "Feature Development", "Bug Fixes", "Learnings").
4. Highlight specific technologies mentioned.
5. Tone: Professional yet personal, like a "Building in Public" update.

Respond in JSON format:
{{
  "title": "string",
  "content": "markdown string"
}}"""

    logger.info(f"[AI] Generating blog for {period_name} with {len(logs)} logs")
    
    try:
        result = await llm.generate_json(prompt)
        if result.get("title") and result.get("content"):
            return BlogPost(
                title=result["title"],
                content=result["content"]
            )
    except Exception as e:
        logger.warning(f"[AI] JSON parse failed, trying fallback: {e}")
    
    # Fallback: try to use raw response as content
    try:
        raw_response = await llm.generate(prompt)
        if raw_response and len(raw_response) > 100:
            return BlogPost(
                title=f"Dev Log: {period_name}",
                content=raw_response
            )
    except Exception as e:
        logger.error(f"[AI] Blog generation failed: {e}")
    
    return BlogPost(
        title=f"Dev Log: {period_name}",
        content="Could not generate blog content."
    )
