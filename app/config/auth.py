from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class AuthConf(BaseSettings):
    jwt_secret: SecretStr = SecretStr("")
    access_token_ttl_seconds: int = Field(default=1800, gt=0)

    email_verification_ttl_seconds: int = Field(default=600, gt=0)
    email_verification_max_attempts: int = Field(default=5, gt=0)
    email_verification_resend_seconds: int = Field(default=60, gt=0)

    model_config = SettingsConfigDict(env_prefix="AUTH_")


auth = AuthConf()
