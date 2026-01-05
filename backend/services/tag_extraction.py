"""
Tag Extraction Service
Extracts technical tags and summaries from work log entries
"""

import logging
from typing import List, Dict, Optional
from pydantic import BaseModel

from llm import get_llm

logger = logging.getLogger(__name__)


class Tag(BaseModel):
    name: str
    category: str  # Language, Framework, Concept, Task, Other


class TagExtractionResult(BaseModel):
    tags: List[Tag]
    summary: str


async def process_entry(text: str) -> TagExtractionResult:
    """
    Analyze a work log entry and extract tags + summary.
    """
    llm = get_llm()
    
    prompt = f"""Analyze this developer work log entry: "{text}". 
1. Extract technical tags (Language, Framework, Concept, Task).
2. Write a very brief (max 10 words) title/summary for this entry.

Respond in JSON format:
{{
  "summary": "string",
  "tags": [{{"name": "string", "category": "Language|Framework|Concept|Task|Other"}}]
}}"""

    try:
        result = await llm.generate_json(prompt)
        return TagExtractionResult(
            tags=[Tag(**t) for t in result.get("tags", [])],
            summary=result.get("summary", text[:50])
        )
    except Exception as e:
        logger.error(f"Failed to process entry: {e}")
        return TagExtractionResult(tags=[], summary=text[:50])


async def batch_process_entries(
    entries: List[Dict[str, str]]
) -> Dict[str, TagExtractionResult]:
    """
    Batch process multiple entries for tag extraction.
    
    Args:
        entries: List of {"id": "...", "content": "..."} dicts
    
    Returns:
        Dict mapping entry id to TagExtractionResult
    """
    if not entries:
        return {}
    
    llm = get_llm()
    entries_text = "\n\n".join(f"[{i}] {e['content']}" for i, e in enumerate(entries))
    
    prompt = f"""Analyze these developer work log entries and extract tags and summaries for each:

{entries_text}

For each entry, extract technical tags (Language, Framework, Concept, Task) and write a brief summary.

Respond in JSON format:
{{
  "results": [
    {{"index": 0, "summary": "string", "tags": [{{"name": "string", "category": "Language|Framework|Concept|Task|Other"}}]}},
    ...
  ]
}}"""

    result_map = {}
    
    try:
        result = await llm.generate_json(prompt)
        
        for r in result.get("results", []):
            idx = r.get("index")
            if idx is not None and idx < len(entries):
                entry = entries[idx]
                result_map[entry["id"]] = TagExtractionResult(
                    tags=[Tag(**t) for t in r.get("tags", [])],
                    summary=r.get("summary", entry["content"][:50])
                )
    except Exception as e:
        logger.error(f"Failed to parse batch AI response: {e}")
    
    return result_map
