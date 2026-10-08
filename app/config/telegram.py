from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class TelegramConf(BaseSettings):
    bot_token: SecretStr | None = None
    client_id: str | None = None
    auth_data_max_age_seconds: int = Field(default=300, gt=0)

    model_config = SettingsConfigDict(env_prefix="TELEGRAM_")


telegram = TelegramConf()
