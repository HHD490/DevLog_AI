"""
AI Utility Services
Small AI helper functions
"""

import logging
from llm import get_llm

logger = logging.getLogger(__name__)


async def generate_conversation_title(first_message: str) -> str:
    """
    Generate a short title for a conversation based on the first message.
    """
    llm = get_llm()
    
    prompt = f"""Generate a very short title (max 5 words) for a conversation that starts with this message:
"{first_message}"

Respond with ONLY the title, no quotes, no explanation."""

    try:
        response = await llm.generate(prompt, temperature=0.5)
        # Clean up the response
        title = response.strip().strip('"\'').strip()[:50]
        return title or "New Chat"
    except Exception as e:
        logger.error(f"[AI] Generate title failed: {e}")
        return "New Chat"
