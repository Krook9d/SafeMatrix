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
    
    # Gmail configuration for email notifications
    gmail_username: str | None = Field(default=None, alias='GMAIL_USERNAME')
    gmail_app_password: str | None = Field(default=None, alias='GMAIL_APP_PASSWORD')
    gmail_from_name: str | None = Field(default=None, alias='GMAIL_FROM_NAME')
    
    # Redis configuration
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    model_config = SettingsConfigDict(env_file="backend/.env", case_sensitive=True, extra='ignore')


def get_settings():
    return Settings()

settings = Settings()