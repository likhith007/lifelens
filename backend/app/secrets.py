import os
from functools import lru_cache

from google.cloud import secretmanager


def _project_id() -> str:
    project_id = os.getenv("GCP_PROJECT_ID") or os.getenv("FIREBASE_PROJECT_ID")
    if not project_id:
        raise RuntimeError(
            "Set FIREBASE_PROJECT_ID (or GCP_PROJECT_ID). Run: ./scripts/setup-secrets.sh"
        )
    return project_id


@lru_cache(maxsize=8)
def get_secret(secret_id: str) -> str:
    """Load a secret value from Google Cloud Secret Manager."""
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{_project_id()}/secrets/{secret_id}/versions/latest"

    try:
        response = client.access_secret_version(request={"name": name})
    except Exception as exc:
        raise RuntimeError(
            f"Failed to read secret '{secret_id}' from Secret Manager. "
            "Run ./scripts/setup-secrets.sh and ensure you have "
            "roles/secretmanager.secretAccessor."
        ) from exc

    payload = response.payload.data.decode("UTF-8").strip()
    if not payload:
        raise RuntimeError(f"Secret '{secret_id}' is empty.")
    return payload


def get_gemini_api_key() -> str:
    secret_id = os.getenv("GEMINI_API_KEY_SECRET_ID", "GEMINI_API_KEY")
    return get_secret(secret_id)
