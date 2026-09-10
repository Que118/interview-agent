from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """全局配置"""
    # 服务
    APP_NAME: str = "智能面试评估系统"
    APP_VERSION: str = "0.1.0"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # LLM — ChatGLM
    CHATGLM_API_URL: str = "http://localhost:7860"  # ChatGLM 本地部署地址
    CHATGLM_MODEL: str = "THUDM/chatglm3-6b"

    # ChromaDB
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8001

    class Config:
        env_file = ".env"


settings = Settings()
