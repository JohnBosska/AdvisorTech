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

    # DeepSeek (OpenAI-compatible API). Primary LLM when the key is set.
    # Embeddings through DeepSeek are opt-in: set `deepseek_embedding_model` only after checking
    # that your account serves /embeddings with `embedding_dim`-sized vectors.
    deepseek_api_key: SecretStr = SecretStr("")
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-flash"
    deepseek_embedding_model: str = ""
    # OpenAI-compatible embeddings gateway (cloud.ru Foundation Models). Highest priority for vectors
    # when `gateway_embedding_api_key` is set. The model must return `embedding_dim` dimensions.
    gateway_embedding_api_key: SecretStr = SecretStr("")
    gateway_embedding_url: str = "https://foundation-models.api.cloud.ru/v1"
    gateway_embedding_model: str = "ai-sage/Giga-Embeddings-instruct-480M"
    max_tokens: int = Field(default=1500, gt=0)

    # Vector search (pgvector) is optional: without an embedding key retrieval is full-text only.
    embedding_api_key: SecretStr = SecretStr("")  # Voyage AI
    embedding_model: str = "voyage-3.5"
    embedding_dim: int = Field(default=1024, gt=0)

    # Cosine similarity (1 - distance) below this is treated as "no match" for vector search.
    # Measured on cloud.ru Giga-Embeddings: relevant 0.29-0.48, unrelated <= 0.04. Re-tune per provider.
    vector_min_similarity: float = Field(default=0.15, ge=-1, le=1)

    top_k: int = Field(default=6, gt=0, le=20)
    max_question_chars: int = Field(default=2000, gt=0)
    max_document_chars: int = Field(default=200_000, gt=0)
    messages_per_minute: int = Field(default=12, gt=0)
    # BI data sources: private/loopback hosts are refused unless explicitly allowed (tests, on-prem).
    bi_allow_private_hosts: bool = False

    model_config = SettingsConfigDict(env_prefix="AI_")

    @property
    def gigachat_configured(self) -> bool:
        return bool(self.gigachat_credentials.get_secret_value())

    @property
    def deepseek_configured(self) -> bool:
        return bool(self.deepseek_api_key.get_secret_value())

    @property
    def gateway_embeddings(self) -> bool:
        return bool(self.gateway_embedding_api_key.get_secret_value())

    @property
    def deepseek_embeddings(self) -> bool:
        return self.deepseek_configured and bool(self.deepseek_embedding_model)

    @property
    def provider(self) -> str | None:
        """DeepSeek wins over GigaChat when both are configured."""
        if self.deepseek_configured:
            return "deepseek"
        if self.gigachat_configured:
            return "gigachat"
        return None

    @property
    def llm_configured(self) -> bool:
        return self.provider is not None

    @property
    def active_model(self) -> str | None:
        return {"deepseek": self.deepseek_model, "gigachat": self.gigachat_model}.get(
            self.provider or ""
        )

    @property
    def vector_configured(self) -> bool:
        return (
            self.gateway_embeddings
            or self.deepseek_embeddings
            or self.gigachat_configured
            or bool(self.embedding_api_key.get_secret_value())
        )


ai = AIConf()
