"""GigaChat (Sber) client: OAuth token cache, chat completions and embeddings."""

import asyncio
import ssl
import time
import uuid
from pathlib import Path

import aiohttp
import certifi

from app.config.ai import ai
from app.exceptions import ServiceUnavailableError
from app.services.llm_types import LLMResult

_CA = Path(__file__).resolve().parent.parent / "certs" / "russian_trusted_sub_ca.pem"
_EMBED_BATCH = 16
_REFRESH_MARGIN_S = 60


def _ssl_context() -> ssl.SSLContext:
    context = ssl.create_default_context(cafile=certifi.where())
    context.load_verify_locations(cafile=str(_CA))  # Russian Trusted Sub CA issues Sber's certs
    return context


class _TokenCache:
    def __init__(self) -> None:
        self._token = ""
        self._expires_at = 0.0
        self._lock = asyncio.Lock()

    async def get(self, http: aiohttp.ClientSession) -> str:
        async with self._lock:
            if self._token and time.time() < self._expires_at - _REFRESH_MARGIN_S:
                return self._token
            headers = {
                "Authorization": f"Basic {ai.gigachat_credentials.get_secret_value()}",
                "RqUID": str(uuid.uuid4()),
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            }
            try:
                async with http.post(
                    ai.gigachat_auth_url, data={"scope": ai.gigachat_scope}, headers=headers
                ) as response:
                    if response.status != 200:
                        raise ServiceUnavailableError("GigaChat authorization failed")
                    payload = await response.json(content_type=None)
            except aiohttp.ClientError as exc:
                raise ServiceUnavailableError("GigaChat is unavailable") from exc
            self._token = payload["access_token"]
            self._expires_at = float(payload["expires_at"]) / 1000.0  # ms epoch
            return self._token

    def reset(self) -> None:
        self._token, self._expires_at = "", 0.0


_tokens = _TokenCache()


def _session() -> aiohttp.ClientSession:
    return aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=90),
        connector=aiohttp.TCPConnector(ssl=_ssl_context()),
    )


async def _post(path: str, body: dict) -> dict:
    async with _session() as http:
        for attempt in (1, 2):
            token = await _tokens.get(http)
            try:
                async with http.post(
                    f"{ai.gigachat_api_url}{path}",
                    json=body,
                    headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                ) as response:
                    if response.status == 401 and attempt == 1:
                        _tokens.reset()  # token revoked early: fetch a new one once
                        continue
                    if response.status != 200:
                        raise ServiceUnavailableError("GigaChat request failed")
                    return await response.json(content_type=None)
            except aiohttp.ClientError as exc:
                raise ServiceUnavailableError("GigaChat is unavailable") from exc
    raise ServiceUnavailableError("GigaChat request failed")


class GigaChatLLM:
    async def complete(self, system: str, messages: list[dict[str, str]]) -> LLMResult:
        payload = await _post(
            "/chat/completions",
            {
                "model": ai.gigachat_model,
                "messages": [{"role": "system", "content": system}, *messages],
                "temperature": 0.2,
                "max_tokens": ai.max_tokens,
            },
        )
        try:
            text = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ServiceUnavailableError("GigaChat returned an unexpected response") from exc
        return LLMResult(text=text.strip(), model=ai.gigachat_model)


async def embed(texts: list[str]) -> list[list[float]]:
    vectors: list[list[float]] = []
    for start in range(0, len(texts), _EMBED_BATCH):
        payload = await _post(
            "/embeddings",
            {"model": ai.gigachat_embedding_model, "input": texts[start : start + _EMBED_BATCH]},
        )
        ordered = sorted(payload["data"], key=lambda item: item["index"])
        vectors.extend(item["embedding"] for item in ordered)
    return vectors
