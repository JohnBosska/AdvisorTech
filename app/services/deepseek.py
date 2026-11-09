"""DeepSeek over its OpenAI-compatible HTTP API (chat completions and, if enabled, embeddings)."""

import aiohttp

from app.config.ai import ai
from app.exceptions import ServiceUnavailableError
from app.services.llm_types import LLMResult

_EMBED_BATCH = 32


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
    vectors: list[list[float]] = []
    for start in range(0, len(texts), _EMBED_BATCH):
        payload = await _post(
            "/embeddings",
            {"model": ai.deepseek_embedding_model, "input": texts[start : start + _EMBED_BATCH]},
        )
        try:
            ordered = sorted(payload["data"], key=lambda item: item["index"])
        except (KeyError, TypeError) as exc:
            raise ServiceUnavailableError("DeepSeek returned unexpected embeddings") from exc
        for item in ordered:
            if len(item["embedding"]) != ai.embedding_dim:
                raise ServiceUnavailableError(
                    f"DeepSeek embeddings have {len(item['embedding'])} dims, "
                    f"the index expects {ai.embedding_dim}"
                )
            vectors.append(item["embedding"])
    return vectors
