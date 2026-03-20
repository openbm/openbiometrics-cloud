from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./openbiometrics.db"
    engine_url: str = "http://localhost:8000"
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    cors_origins: str = "http://localhost:5173,http://localhost:4321,https://app.openbiometrics.dev,https://openbiometrics.dev"

    # Rate limits per minute by plan
    rate_limit_free: int = 10
    rate_limit_developer: int = 100
    rate_limit_pro: int = 500
    rate_limit_enterprise: int = 5000

    # Monthly call limits by plan
    monthly_limit_free: int = 100
    monthly_limit_developer: int = 10_000
    monthly_limit_pro: int = 100_000
    monthly_limit_enterprise: int = 10_000_000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
