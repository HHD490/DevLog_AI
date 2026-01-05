"""
DeepSeek LLM Provider
Uses OpenAI-compatible API
"""

import httpx
from typing import AsyncIterator
from .base import BaseLLM


class DeepSeekLLM(BaseLLM):
    """DeepSeek LLM using OpenAI-compatible API."""
    
    name = "DeepSeek"
    
    def __init__(self, api_key: str, model: str = "deepseek-chat"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.deepseek.com/v1"
    
    async def generate(self, prompt: str, temperature: float = 0.7) -> str:
        """Generate a response from a prompt."""
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}"
                },
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": temperature,
                    "max_tokens": 4096
                }
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
    
    async def generate_stream(self, prompt: str, temperature: float = 0.7) -> AsyncIterator[str]:
        """Generate a streaming response from a prompt."""
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}"
                },
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": temperature,
                    "max_tokens": 4096,
                    "stream": True
                }
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        import json
                        chunk = json.loads(data)
                        if content := chunk["choices"][0].get("delta", {}).get("content"):
                            yield content
    
    async def generate_json(self, prompt: str, temperature: float = 0.3) -> dict:
        """Generate a JSON response from a prompt."""
        text = await self.generate(prompt, temperature)
        return self._extract_json(text)
