from pydantic import AliasChoices, Field, PostgresDsn
from pydantic_settings import BaseSettings


class AlchemyConf(BaseSettings):
    host: str = "localhost"
    port: int = 5432
    username: str = Field(
        default="salon_booking",
        validation_alias=AliasChoices("POSTGRES_USER", "POSTGRES_USERNAME"),
    )
    password: str = ""
    database: str = Field(
        default="salon_booking",
        validation_alias=AliasChoices("POSTGRES_DB", "POSTGRES_DATABASE"),
    )
    pool_size: int = 10
    max_overflow: int = 50
    pool_timeout: int = 30
    pool_recycle: int = 1800
    pool_pre_ping: bool = True

    model_config = {"env_prefix": "POSTGRES_"}

    @property
    def dsn(self) -> PostgresDsn:
        return PostgresDsn.build(
            scheme="postgresql+asyncpg",
            username=self.username,
            password=self.password,
            host=self.host,
            port=self.port,
            path=self.database,
        )
