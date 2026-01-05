"""
LLM Factory
Creates LLM instances based on configuration
"""

import logging
from typing import Optional
from .base import BaseLLM
from .deepseek import DeepSeekLLM
from .gemini import GeminiLLM
from .openai import OpenAILLM

logger = logging.getLogger(__name__)

# Cached instance
_cached_llm: Optional[BaseLLM] = None


def get_llm(provider: Optional[str] = None) -> BaseLLM:
    """
    Get an LLM instance based on configuration.
    
    Args:
        provider: Override provider name (deepseek, gemini, openai)
                  If None, uses AI_PROVIDER env var or auto-detects
    
    Returns:
        BaseLLM instance
    
    Priority:
        1. Explicit provider parameter
        2. AI_PROVIDER environment variable
        3. Auto-detect based on available API keys (DeepSeek > Gemini > OpenAI)
    """
    global _cached_llm
    
    from config.settings import AI_PROVIDER, DEEPSEEK_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY
    
    # Use provided or configured provider
    selected_provider = provider or AI_PROVIDER
    
    # If provider is explicitly set, use it
    if selected_provider:
        selected_provider = selected_provider.lower()
        
        if selected_provider == "deepseek" and DEEPSEEK_API_KEY:
            logger.info("[LLM] Using DeepSeek provider")
            return DeepSeekLLM(DEEPSEEK_API_KEY)
        
        if selected_provider == "gemini" and GEMINI_API_KEY:
            logger.info("[LLM] Using Gemini provider")
            return GeminiLLM(GEMINI_API_KEY)
        
        if selected_provider == "openai" and OPENAI_API_KEY:
            logger.info("[LLM] Using OpenAI provider")
            return OpenAILLM(OPENAI_API_KEY)
    
    # Auto-detect based on available keys
    if DEEPSEEK_API_KEY:
        logger.info("[LLM] Auto-selected DeepSeek (key available)")
        return DeepSeekLLM(DEEPSEEK_API_KEY)
    
    if GEMINI_API_KEY:
        logger.info("[LLM] Auto-selected Gemini (key available)")
        return GeminiLLM(GEMINI_API_KEY)
    
    if OPENAI_API_KEY:
        logger.info("[LLM] Auto-selected OpenAI (key available)")
        return OpenAILLM(OPENAI_API_KEY)
    
    raise ValueError(
        "No LLM API key configured. Please set one of: "
        "DEEPSEEK_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in .env.local"
    )


def get_current_provider_name() -> str:
    """Get the name of the current LLM provider."""
    try:
        return get_llm().name
    except ValueError:
        return "None"
