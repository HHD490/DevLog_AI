"""
Skill Tree Analysis Service
Analyzes logs and summaries to generate/update skill tree
"""

import logging
import json
from typing import List, Optional
from pydantic import BaseModel

from llm import get_llm

logger = logging.getLogger(__name__)


class SkillUpdate(BaseModel):
    name: str
    category: str  # Language, Framework, Tool, Concept, Platform
    maturity_level: int  # 1-5
    work_examples: List[str]
    is_update: bool = False


class ExistingSkill(BaseModel):
    name: str
    category: str
    maturity_level: int


class LogEntry(BaseModel):
    id: str
    content: str
    tags_json: str
    timestamp: int


class SummaryEntry(BaseModel):
    date: str
    content: str
    tech_stack_json: str


async def analyze_for_skill_tree(
    new_logs: List[LogEntry],
    new_summaries: List[SummaryEntry],
    existing_skill_tree: List[ExistingSkill]
) -> List[SkillUpdate]:
    """
    Analyze logs and summaries to generate/update skill tree.
    """
    llm = get_llm()
    
    # Format logs context
    logs_context = "\n".join(
        f"[{log.timestamp}] {log.content} (Tags: {', '.join(t.get('name', '') for t in json.loads(log.tags_json or '[]'))})"
        for log in new_logs
    ) if new_logs else "None"
    
    # Format summaries context
    summaries_context = "\n".join(
        f"[{s.date}] {s.content} (Tech: {', '.join(json.loads(s.tech_stack_json or '[]'))})"
        for s in new_summaries
    ) if new_summaries else "None"
    
    # Format existing skills
    existing_skills_context = "\n".join(
        f"{s.name} ({s.category}): Level {s.maturity_level}/5"
        for s in existing_skill_tree
    ) if existing_skill_tree else "None"
    
    prompt = f"""Analyze the following new work logs and daily summaries to update a developer's skill tree.

NEW LOGS:
{logs_context}

NEW SUMMARIES:
{summaries_context}

EXISTING SKILL TREE:
{existing_skills_context}

Based on the new data, identify skills to add or update. Consider:
1. Only include skills with sufficient evidence (mentioned multiple times or with depth)
2. Maturity level 1-5 based on: frequency, depth of work, variety of applications
3. Include specific work examples for each skill
4. Categories: Language, Framework, Tool, Concept, Platform

Respond in JSON format:
{{
  "skills": [
    {{
      "name": "React",
      "category": "Framework",
      "maturityLevel": 4,
      "workExamples": ["Built dashboard with hooks", "Implemented state management"],
      "isUpdate": true
    }}
  ]
}}

Only include skills that have strong evidence in the new data. Set maturityLevel to at least the existing level if updating."""

    try:
        result = await llm.generate_json(prompt)
        skills = []
        for s in result.get("skills", []):
            skills.append(SkillUpdate(
                name=s.get("name", ""),
                category=s.get("category", "Other"),
                maturity_level=s.get("maturityLevel", 1),
                work_examples=s.get("workExamples", []),
                is_update=s.get("isUpdate", False)
            ))
        return skills
    except Exception as e:
        logger.error(f"[AI] Skill tree analysis failed: {e}")
        return []
