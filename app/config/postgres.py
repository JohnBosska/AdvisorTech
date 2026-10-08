from pydantic_settings import BaseSettings
from pydantic import PostgresDsn


class AlchemyConf(BaseSettings):
    host: str = "localhost"
    port: int = 5432
    username: str = "salon_booking"
    password: str = ""
    database: str = "salon_booking"
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
