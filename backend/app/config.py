from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    database_url: str

    # Gnani TTS
    gnani_api_key: str
    gnani_voice: str = "meera"
    gnani_language: str = "en-IN"
    gnani_model: str = "timbre-v2.5"
    gnani_endpoint: str = "https://api.vachana.ai/api/v1/tts/inference"

    # Tavily
    tavily_api_key: str

    # LLM (Google Gemini)
    gemini_api_key: str
    gemini_model: str = "gemini-3.8-flash"

    # Email
    resend_api_key: str
    email_from: str = "Daily Brief <onboarding@resend.dev>"

    # URLs
    app_url: str = "http://localhost:3000"

    # CORS — comma-separated list of allowed frontend origins
    cors_origins: str = "http://localhost:3000"

    # Rate limiting for Generate Now (per user per day)
    generate_now_daily_limit: int = 5


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
