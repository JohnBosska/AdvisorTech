from pydantic_settings import BaseSettings, SettingsConfigDict


class TemporalConf(BaseSettings):
    address: str = "localhost:7233"
    namespace: str = "default"
    task_queue: str = "techadviser-default"

    model_config = SettingsConfigDict(env_prefix="TEMPORAL_")


temporal = TemporalConf()
