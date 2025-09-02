import base64
import hashlib
import json
from typing import Any, Dict

from cryptography.fernet import Fernet, InvalidToken


def _derive_fernet_key(secret_key: str) -> bytes:
    """
    Derive a Fernet key from an arbitrary SECRET_KEY string.
    """
    if not isinstance(secret_key, str) or not secret_key:
        raise ValueError("SECRET_KEY must be a non-empty string")
    digest = hashlib.sha256(secret_key.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def get_fernet(secret_key: str) -> Fernet:
    return Fernet(_derive_fernet_key(secret_key))


def encrypt_dict(data: Dict[str, Any], secret_key: str) -> str:
    """
    Encrypt a dict as a compact JSON string using Fernet.
    Returns a base64 token string.
    """
    f = get_fernet(secret_key)
    payload = json.dumps(data, separators=(",", ":")).encode("utf-8")
    token = f.encrypt(payload)
    return token.decode("utf-8")


def decrypt_dict(token: str, secret_key: str) -> Dict[str, Any]:
    """
    Decrypt a previously encrypted token back into a dict.
    """
    f = get_fernet(secret_key)
    try:
        payload = f.decrypt(token.encode("utf-8"))
    except InvalidToken:
        # Backward compatibility/path for empty or invalid content
        return {}
    return json.loads(payload.decode("utf-8"))
