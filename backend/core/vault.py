from typing import Any, Dict, Tuple

from backend.core.config import settings
from backend.core.crypto import encrypt_dict, decrypt_dict

# Define which fields are considered secrets per connector type
SECRET_FIELDS = {
    "EMAIL": ["password"],
    "THEHIVE": ["api_key"],
    "SERVICENOW": ["password"],
}
# Optionally treat usernames as non-secret to allow display/use without decryption
# If you want to hide usernames too, add "username" into the lists above.


def split_config_and_credentials(connector_type: str, config: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Split a connector config into (public_config, secrets) based on SECRET_FIELDS.
    public_config keeps non-secret keys. secrets collects secret keys.
    """
    secrets: Dict[str, Any] = {}
    public: Dict[str, Any] = {}

    secret_keys = set(SECRET_FIELDS.get(str(connector_type), []))

    for k, v in (config or {}).items():
        if k in secret_keys and v not in (None, ""):
            secrets[k] = v
            # Do NOT include clear secret in public config
            continue
        public[k] = v

    return public, secrets


def merge_credentials_into_config(connector_type: str, public_config: Dict[str, Any], encrypted_credentials: str | None) -> Dict[str, Any]:
    """
    Merge decrypted credentials into a public config for runtime usage.
    """
    cfg: Dict[str, Any] = dict(public_config or {})
    if encrypted_credentials:
        secrets = decrypt_dict(encrypted_credentials, settings.SECRET_KEY)
        cfg.update({k: v for k, v in secrets.items() if v not in (None, "")})
    return cfg


def encrypt_credentials(secrets: Dict[str, Any]) -> str | None:
    if not secrets:
        return None
    return encrypt_dict(secrets, settings.SECRET_KEY)
