from pydantic import Field
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

    # Using Field to allow for an alias from the .env file
    nvd_api_key: str | None = Field(default=None, alias='NVD_TOKEN_API')

    model_config = SettingsConfigDict(env_file="backend/.env", case_sensitive=True)


settings = Settings() 