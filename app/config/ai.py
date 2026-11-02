from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class AIConf(BaseSettings):
    """AI analyst settings. Empty keys mean the feature reports itself as not configured."""

    anthropic_api_key: SecretStr = SecretStr("")
    model: str = "claude-sonnet-5-5"
    max_tokens: int = Field(default=1500, gt=0)

    # Vector search (pgvector) is optional: without an embedding key retrieval is full-text only.
    embedding_api_key: SecretStr = SecretStr("")  # Voyage AI
    embedding_model: str = "voyage-3.5"
    embedding_dim: int = Field(default=1024, gt=0)

    top_k: int = Field(default=6, gt=0, le=20)
    max_question_chars: int = Field(default=2000, gt=0)
    max_document_chars: int = Field(default=200_000, gt=0)
    messages_per_minute: int = Field(default=12, gt=0)

    model_config = SettingsConfigDict(env_prefix="AI_")

    @property
    def llm_configured(self) -> bool:
        return bool(self.anthropic_api_key.get_secret_value())

    @property
    def vector_configured(self) -> bool:
        return bool(self.embedding_api_key.get_secret_value())


ai = AIConf()
