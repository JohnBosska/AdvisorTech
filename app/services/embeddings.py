import aiohttp

from app.config.ai import ai
from app.exceptions import ServiceUnavailableError
from app.services import gigachat

_URL = "https://api.voyageai.com/v1/embeddings"
_BATCH = 64


async def embed(texts: list[str], *, input_type: str) -> list[list[float]]:
    """GigaChat embeddings when configured, otherwise Voyage AI.

    input_type ('document' | 'query') only matters for Voyage.
    """
    if ai.gigachat_configured:
        return await gigachat.embed(texts)
    vectors: list[list[float]] = []
    headers = {"Authorization": f"Bearer {ai.embedding_api_key.get_secret_value()}"}
    timeout = aiohttp.ClientTimeout(total=60)
    async with aiohttp.ClientSession(timeout=timeout) as http:
        for start in range(0, len(texts), _BATCH):
            body = {
                "input": texts[start : start + _BATCH],
                "model": ai.embedding_model,
                "input_type": input_type,
                "output_dimension": ai.embedding_dim,
            }
            try:
                async with http.post(_URL, json=body, headers=headers) as response:
                    if response.status != 200:
                        raise ServiceUnavailableError("Embedding provider is unavailable")
                    payload = await response.json()
            except aiohttp.ClientError as exc:
                raise ServiceUnavailableError("Embedding provider is unavailable") from exc
            vectors.extend(item["embedding"] for item in payload["data"])
    return vectors
