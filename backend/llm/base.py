"""
LLM Provider Base Class
Abstract interface for all LLM providers
"""

from abc import ABC, abstractmethod
from typing import AsyncIterator, Optional


class BaseLLM(ABC):
    """Abstract base class for LLM providers."""
    
    name: str = "base"
    
    @abstractmethod
    async def generate(self, prompt: str, temperature: float = 0.7) -> str:
        """Generate a response from a prompt."""
        pass
    
    @abstractmethod
    async def generate_stream(self, prompt: str, temperature: float = 0.7) -> AsyncIterator[str]:
        """Generate a streaming response from a prompt."""
        pass
    
    @abstractmethod
    async def generate_json(self, prompt: str, temperature: float = 0.3) -> dict:
        """Generate a JSON response from a prompt. Lower temperature for structured output."""
        pass
    
    def _extract_json(self, text: str) -> dict:
        """Extract JSON from text, handling markdown code blocks."""
        import json
        import re
        
        # Try to extract from markdown code block
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
        if json_match:
            text = json_match.group(1).strip()
        
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON object in text
            start = text.find('{')
            end = text.rfind('}') + 1
            if start != -1 and end > start:
                return json.loads(text[start:end])
            raise
