"""
License key generation and validation utilities
"""
import hashlib
import hmac
import secrets
import string
import re
from datetime import datetime, timezone
import base64
import os

SECRET_SALT = os.getenv("LICENSE_SALT", "LMSPro-2024-SuperSecretSalt!")


def generate_license_key(prefix: str = "LMS", segments: int = 4, seg_len: int = 5) -> str:
    """
    Generate a random license key like: LMS-XXXXX-XXXXX-XXXXX-XXXXX
    """
    chars = string.ascii_uppercase + string.digits
    parts = [prefix] + [
        "".join(secrets.choice(chars) for _ in range(seg_len))
        for _ in range(segments)
    ]
    return "-".join(parts)


def validate_key_format(key: str) -> bool:
    """Check that a key matches the expected pattern."""
    pattern = r"^[A-Z0-9]{2,6}(-[A-Z0-9]{4,8}){3,5}$"
    return bool(re.match(pattern, key.upper().strip()))


def check_license_validity(license_data: dict) -> dict:
    """
    Given a license record from the DB, return a validity report.
    """
    result = {
        "valid": False,
        "reason": "",
        "status": license_data.get("status", "unknown"),
    }

    status = license_data.get("status", "")
    if status == "revoked":
        result["reason"] = "License has been revoked."
        return result
    if status == "suspended":
        result["reason"] = "License is suspended."
        return result
    if status == "expired":
        result["reason"] = "License has expired."
        return result
    if status == "inactive":
        result["reason"] = "License has not been activated yet."
        return result

    # Check expiry_date
    expiry_date = license_data.get("expiry_date")
    if expiry_date:
        try:
            exp = datetime.fromisoformat(expiry_date.replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                result["reason"] = "License expiry date has passed."
                result["status"] = "expired"
                return result
        except Exception:
            pass

    result["valid"] = True
    result["reason"] = "License is valid and active."
    return result


def mask_key(key: str) -> str:
    """Show only first and last segment for display purposes."""
    parts = key.split("-")
    if len(parts) <= 2:
        return key
    masked = [parts[0]] + ["*****"] * (len(parts) - 2) + [parts[-1]]
    return "-".join(masked)


def days_until_expiry(expiry_date_str: str | None) -> int | None:
    """Return number of days until expiry, or None if no expiry."""
    if not expiry_date_str:
        return None
    try:
        exp = datetime.fromisoformat(expiry_date_str.replace("Z", "+00:00"))
        delta = exp - datetime.now(timezone.utc)
        return delta.days
    except Exception:
        return None
