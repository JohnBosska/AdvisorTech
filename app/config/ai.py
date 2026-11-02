from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class AIConf(BaseSettings):
    """AI analyst settings. Empty keys mean the feature reports itself as not configured."""

    # GigaChat (Sber). `credentials` is the base64 "Authorization key" from the developer portal.
    # When set it is used for chat AND embeddings (1024-dim, matches the pgvector column).
    gigachat_credentials: SecretStr = SecretStr("")
    gigachat_scope: str = (
        "GIGACHAT_API_PERS"  # GIGACHAT_API_B2B / GIGACHAT_API_CORP for business plans
    )
    gigachat_model: str = "GigaChat"
    gigachat_embedding_model: str = "Embeddings"
    gigachat_auth_url: str = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    gigachat_api_url: str = "https://gigachat.devices.sberbank.ru/api/v1"

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
    def gigachat_configured(self) -> bool:
        return bool(self.gigachat_credentials.get_secret_value())

    @property
    def provider(self) -> str | None:
        """GigaChat wins when both are configured."""
        if self.gigachat_configured:
            return "gigachat"
        if self.anthropic_api_key.get_secret_value():
            return "anthropic"
        return None

    @property
    def llm_configured(self) -> bool:
        return self.provider is not None

    @property
    def active_model(self) -> str | None:
        return {"gigachat": self.gigachat_model, "anthropic": self.model}.get(self.provider or "")

    @property
    def vector_configured(self) -> bool:
        return self.gigachat_configured or bool(self.embedding_api_key.get_secret_value())


ai = AIConf()
