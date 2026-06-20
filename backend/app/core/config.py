"""
Core configuration — reads from environment variables via Pydantic Settings.
Single source of truth for all app configuration.
Free-tier only: Groq + SQLite + FAISS (no cloud services required).
"""
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Project root (backend/)
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    APP_ENV: Literal["development", "staging", "production"] = "development"
    APP_NAME: str = "AI Chatbot"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = True
    SECRET_KEY: str = "change-this-secret-key-in-production"

    # --- SQLite Database ---
    SQLITE_PATH: str = "chatbot.db"

    @property
    def DATABASE_URL(self) -> str:
        return f"sqlite+aiosqlite:///{self.SQLITE_PATH}"

    @property
    def DATABASE_URL_SYNC(self) -> str:
        return f"sqlite:///{self.SQLITE_PATH}"

    # --- LangGraph SQLite Checkpointer ---
    LANGGRAPH_CHECKPOINT_DB: str = "chatbot_checkpoints.db"

    # --- FAISS Vector Store ---
    FAISS_INDEX_DIR: str = "faiss_indexes"

    @property
    def faiss_index_path(self) -> Path:
        p = Path(self.FAISS_INDEX_DIR)
        p.mkdir(parents=True, exist_ok=True)
        return p

    # --- Local File Storage ---
    UPLOAD_DIR: str = "uploads"

    @property
    def upload_path(self) -> Path:
        p = Path(self.UPLOAD_DIR)
        p.mkdir(parents=True, exist_ok=True)
        return p

    # --- JWT ---
    JWT_SECRET_KEY: str = "change-this-jwt-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # --- Groq LLM (FREE TIER) ---
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_MODEL_FAST: str = "llama-3.1-8b-instant"
    GROQ_MODEL_REASONING: str = "deepseek-r1-distill-llama-70b"
    GROQ_TEMPERATURE: float = 0.7
    GROQ_MAX_TOKENS: int = 4096

    # --- LangSmith Observability (optional, free tier) ---
    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_ENDPOINT: str = "https://api.smith.langchain.com"
    LANGCHAIN_API_KEY: str = ""
    LANGCHAIN_PROJECT: str = "chatbot-development"

    # --- Web Search (Free: DuckDuckGo default, Tavily optional) ---
    TAVILY_API_KEY: str = ""
    USE_TAVILY: bool = False

    # --- CORS — stored as plain string, parsed into list ---
    # In .env use comma-separated: ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
    ALLOWED_ORIGINS_STR: str = "http://localhost:3000,http://localhost:3001"
    FRONTEND_URL: str = "http://localhost:3000"

    @property
    def ALLOWED_ORIGINS(self) -> list[str]:
        """Parse ALLOWED_ORIGINS from comma-separated string."""
        raw = self.ALLOWED_ORIGINS_STR.strip()
        if not raw:
            return ["http://localhost:3000"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    # --- Rate Limiting (in-memory, no Redis) ---
    RATE_LIMIT_REQUESTS: int = 60
    RATE_LIMIT_WINDOW: int = 60  # seconds

    # --- MCP Configuration ---
    MCP_CONFIG_PATH: str = "mcp_config.json"
    MCP_TIMEOUT: int = 30

    # --- Memory System ---
    MEMORY_MAX_RESULTS: int = 5
    MEMORY_SIMILARITY_THRESHOLD: float = 0.3
    MEMORY_EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # --- Reflection ---
    REFLECTION_SCORE_THRESHOLD: float = 0.7
    REFLECTION_MAX_RETRIES: int = 2

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance — call this everywhere via DI."""
    return Settings()


settings = get_settings()
