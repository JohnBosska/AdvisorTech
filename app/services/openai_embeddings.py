"""Embeddings over any OpenAI-compatible `/embeddings` endpoint (cloud.ru Foundation Models, DeepSeek)."""

import aiohttp

from app.config.ai import ai
from app.exceptions import ServiceUnavailableError

_BATCH = 32


async def embed_openai(
    base_url: str, api_key: str, model: str, texts: list[str]
) -> list[list[float]]:
    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
    timeout = aiohttp.ClientTimeout(total=90)
    vectors: list[list[float]] = []
    try:
        async with aiohttp.ClientSession(timeout=timeout) as http:
            for start in range(0, len(texts), _BATCH):
                body = {"model": model, "input": texts[start : start + _BATCH]}
                async with http.post(
                    f"{base_url.rstrip('/')}/embeddings", json=body, headers=headers
                ) as response:
                    if response.status != 200:
                        raise ServiceUnavailableError(
                            f"Embedding provider failed ({response.status})"
                        )
                    payload = await response.json(content_type=None)
                try:
                    ordered = sorted(payload["data"], key=lambda item: item["index"])
                except (KeyError, TypeError) as exc:
                    raise ServiceUnavailableError("Embedding provider returned junk") from exc
                for item in ordered:
                    if len(item["embedding"]) != ai.embedding_dim:
                        raise ServiceUnavailableError(
                            f"Embeddings have {len(item['embedding'])} dims, "
                            f"the index expects {ai.embedding_dim}"
                        )
                    vectors.append(item["embedding"])
    except aiohttp.ClientError as exc:
        raise ServiceUnavailableError("Embedding provider is unavailable") from exc
    return vectors
