from typing import List, Union
from pydantic import AnyHttpUrl, validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AgriNexus AI API"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "supersecretjwtkeyforagrinexusdevonly123!"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = "postgresql://agrinexus_user:agrinexus_password@localhost:5432/agrinexus_db"
    
    # ML Vision & SAR Thresholds
    CROP_GATE_THRESHOLD: float = 0.85
    CROP_CLASSIFIER_THRESHOLD: float = 0.80
    DISEASE_CLASSIFIER_THRESHOLD: float = 0.80
    SENTINEL1_STAC_URL: str = "https://earth-search.aws.element84.com/v1"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
