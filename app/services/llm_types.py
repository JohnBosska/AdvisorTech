from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class LLMResult:
    text: str
    model: str


class LLM(Protocol):
    async def complete(self, system: str, messages: list[dict[str, str]]) -> LLMResult: ...
