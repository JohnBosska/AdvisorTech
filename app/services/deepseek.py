"""DeepSeek over its OpenAI-compatible HTTP API (chat completions and, if enabled, embeddings)."""

import aiohttp

from app.config.ai import ai
from app.exceptions import ServiceUnavailableError
from app.services.llm_types import LLMResult
from app.services.openai_embeddings import embed_openai


async def _post(path: str, body: dict) -> dict:
    headers = {
        "Authorization": f"Bearer {ai.deepseek_api_key.get_secret_value()}",
        "Accept": "application/json",
    }
    timeout = aiohttp.ClientTimeout(total=90)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as http:
            async with http.post(
                f"{ai.deepseek_base_url.rstrip('/')}{path}", json=body, headers=headers
            ) as response:
                if response.status != 200:
                    raise ServiceUnavailableError(f"DeepSeek request failed ({response.status})")
                return await response.json(content_type=None)
    except aiohttp.ClientError as exc:
        raise ServiceUnavailableError("DeepSeek is unavailable") from exc


class DeepSeekLLM:
    async def complete(self, system: str, messages: list[dict[str, str]]) -> LLMResult:
        payload = await _post(
            "/chat/completions",
            {
                "model": ai.deepseek_model,
                "messages": [{"role": "system", "content": system}, *messages],
                "temperature": 0.2,
                "max_tokens": ai.max_tokens,
                "stream": False,
            },
        )
        try:
            text = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ServiceUnavailableError("DeepSeek returned an unexpected response") from exc
        return LLMResult(text=(text or "").strip(), model=payload.get("model") or ai.deepseek_model)


async def embed(texts: list[str]) -> list[list[float]]:
    return await embed_openai(
        ai.deepseek_base_url,
        ai.deepseek_api_key.get_secret_value(),
        ai.deepseek_embedding_model,
        texts,
    )
