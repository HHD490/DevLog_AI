"""
Gemini LLM Provider
Uses Google GenAI SDK (new unified SDK)
"""

from typing import AsyncIterator
from google import genai
from google.genai.types import GenerateContentConfig
from .base import BaseLLM


class GeminiLLM(BaseLLM):
    """Gemini LLM using Google GenAI SDK."""
    
    name = "Gemini"
    
    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self.client = genai.Client(api_key=api_key)
        self.model_name = model
    
    async def generate(self, prompt: str, temperature: float = 0.7) -> str:
        """Generate a response from a prompt."""
        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=GenerateContentConfig(temperature=temperature)
        )
        return response.text
    
    async def generate_stream(self, prompt: str, temperature: float = 0.7) -> AsyncIterator[str]:
        """Generate a streaming response from a prompt."""
        async for chunk in self.client.aio.models.generate_content_stream(
            model=self.model_name,
            contents=prompt,
            config=GenerateContentConfig(temperature=temperature)
        ):
            if chunk.text:
                yield chunk.text
    
    async def generate_json(self, prompt: str, temperature: float = 0.3) -> dict:
        """Generate a JSON response from a prompt."""
        text = await self.generate(prompt, temperature)
        return self._extract_json(text)
