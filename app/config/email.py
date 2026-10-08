from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class EmailConf(BaseSettings):
    host: str = ""
    port: int = 587
    username: str | None = None
    password: SecretStr | None = None
    sender: str = ""
    start_tls: bool = True
    use_tls: bool = False

    model_config = SettingsConfigDict(env_prefix="EMAIL_")


email = EmailConf()
