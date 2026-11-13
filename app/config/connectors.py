from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class ConnectorConf(BaseSettings):
    """Server-side connectors. `secret` encrypts stored credentials; without it they cannot be saved."""

    secret: SecretStr = SecretStr("")
    page_size: int = Field(default=500, ge=50, le=5000)
    max_pages_per_entity: int = Field(default=40, ge=1, le=1000)  # cap per run: 20 000 rows default

    model_config = SettingsConfigDict(env_prefix="CONNECTOR_")

    @property
    def configured(self) -> bool:
        return len(self.secret.get_secret_value()) >= 16


connectors = ConnectorConf()
