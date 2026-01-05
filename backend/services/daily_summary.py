"""
Daily Summary Service
Generates structured daily summaries from work logs
"""

import logging
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

from llm import get_llm

logger = logging.getLogger(__name__)


class DailySummary(BaseModel):
    date: str
    content: str
    key_achievements: List[str]
    tech_stack_used: List[str]


class LogEntry(BaseModel):
    timestamp: int
    content: str
    source: Optional[str] = "manual"


async def generate_daily_summary(date: str, logs: List[LogEntry]) -> DailySummary:
    """
    Generate a structured daily summary from a list of logs.
    Identifies GitHub commits and provides AI-enhanced interpretation.
    """
    llm = get_llm()
    
    # Separate manual logs from GitHub commits
    manual_logs = [l for l in logs if l.source != "github"]
    github_logs = [l for l in logs if l.source == "github"]
    
    def format_time(ts: int) -> str:
        return datetime.fromtimestamp(ts / 1000).strftime("%H:%M")
    
    manual_logs_text = (
        "\n".join(f"- [{format_time(l.timestamp)}] {l.content}" for l in manual_logs)
        if manual_logs else "(No manual logs today)"
    )
    
    github_section = ""
    if github_logs:
        github_logs_text = "\n".join(
            f"- [{format_time(l.timestamp)}] {l.content}" for l in github_logs
        )
        github_section = f"""=== GITHUB COMMITS (Need Interpretation) ===
{github_logs_text}

Note: The GitHub commits above are raw commit messages synced from my repositories. 
Please interpret what kind of work these commits represent based on:
- Repository names (e.g., [HHD490/DevLog_AI] suggests working on the DevLog AI project)
- Commit message patterns (feat:, fix:, refactor:, etc.)
- Any technical keywords

In your summary, clearly indicate which parts are interpreted from GitHub commits vs. manual logs.
"""
    
    github_instruction = (
        "Include a section starting with '📎 From GitHub:' to summarize work interpreted from commits."
        if github_logs else ""
    )
    
    prompt = f"""You are a Senior Technical Lead. Summarize my work for {date} based on these logs:

=== MANUAL WORK LOGS ===
{manual_logs_text}

{github_section}

Output a structured summary in JSON format:
{{
  "content": "A paragraph summary of the day. {github_instruction}",
  "keyAchievements": ["achievement 1", "achievement 2"],
  "techStackUsed": ["tech1", "tech2"]
}}"""

    logger.info(f"[AI] Generating daily summary for {date} with {len(logs)} logs")
    
    try:
        result = await llm.generate_json(prompt)
        return DailySummary(
            date=date,
            content=result.get("content", "No summary available."),
            key_achievements=result.get("keyAchievements", []),
            tech_stack_used=result.get("techStackUsed", [])
        )
    except Exception as e:
        logger.error(f"[AI] Failed to generate daily summary: {e}")
        return DailySummary(
            date=date,
            content="Failed to generate summary.",
            key_achievements=[],
            tech_stack_used=[]
        )
