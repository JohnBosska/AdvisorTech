from anthropic import APIError, AsyncAnthropic

from app.config.ai import ai
from app.exceptions import ServiceUnavailableError
from app.services.gigachat import GigaChatLLM
from app.services.llm_types import LLM, LLMResult

__all__ = ["LLM", "LLMResult", "get_llm"]


class AnthropicLLM:
    def __init__(self) -> None:
        self._client = AsyncAnthropic(
            api_key=ai.anthropic_api_key.get_secret_value(), timeout=60.0, max_retries=1
        )

    async def complete(self, system: str, messages: list[dict[str, str]]) -> LLMResult:
        try:
            response = await self._client.messages.create(
                model=ai.model, max_tokens=ai.max_tokens, system=system, messages=messages
            )
        except APIError as exc:
            raise ServiceUnavailableError("The AI model is temporarily unavailable") from exc
        text = "".join(block.text for block in response.content if block.type == "text")
        return LLMResult(text=text.strip(), model=ai.model)


def get_llm() -> LLM:
    """Raises 503 when no key is configured. Tests monkeypatch this function."""
    if ai.provider == "gigachat":
        return GigaChatLLM()
    if ai.provider == "anthropic":
        return AnthropicLLM()
    raise ServiceUnavailableError("AI analyst is not configured")
