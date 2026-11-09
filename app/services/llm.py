from app.config.ai import ai
from app.exceptions import ServiceUnavailableError
from app.services.deepseek import DeepSeekLLM
from app.services.gigachat import GigaChatLLM
from app.services.llm_types import LLM, LLMResult

__all__ = ["LLM", "LLMResult", "get_llm"]


def get_llm() -> LLM:
    """Raises 503 when no key is configured. Tests monkeypatch this function."""
    if ai.provider == "deepseek":
        return DeepSeekLLM()
    if ai.provider == "gigachat":
        return GigaChatLLM()
    raise ServiceUnavailableError("AI analyst is not configured")
