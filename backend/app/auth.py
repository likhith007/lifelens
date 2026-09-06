import os

import firebase_admin
from firebase_admin import auth, credentials

_app_initialized = False


def _init_firebase() -> None:
    global _app_initialized
    if _app_initialized or firebase_admin._apps:
        _app_initialized = True
        return

    project_id = os.getenv("FIREBASE_PROJECT_ID")
    if not project_id:
        raise RuntimeError("FIREBASE_PROJECT_ID is not configured")

    client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
    private_key = os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n")

    if client_email and private_key:
        cred = credentials.Certificate(
            {
                "type": "service_account",
                "project_id": project_id,
                "private_key": private_key,
                "client_email": client_email,
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        )
        firebase_admin.initialize_app(cred, {"projectId": project_id})
    else:
        firebase_admin.initialize_app(options={"projectId": project_id})

    _app_initialized = True


def verify_bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise ValueError("Missing or invalid Authorization header")

    token = authorization[7:].strip()
    if not token:
        raise ValueError("Empty bearer token")

    _init_firebase()
    decoded = auth.verify_id_token(token)
    uid = decoded.get("uid")
    if not uid:
        raise ValueError("Invalid token: missing uid")
    return uid
