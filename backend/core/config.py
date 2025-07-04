from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Application settings.
    """
    DATABASE_URL: str
    OPENSEARCH_HOST: str
    OPENSEARCH_PORT: int
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    model_config = SettingsConfigDict(env_file="backend/.env", case_sensitive=True)


settings = Settings() 