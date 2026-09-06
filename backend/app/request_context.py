"""Per-request context for ADK tools (e.g. Google OAuth access token)."""

from contextvars import ContextVar

_google_access_token: ContextVar[str | None] = ContextVar("google_access_token", default=None)
_user_timezone: ContextVar[str] = ContextVar("user_timezone", default="Asia/Kolkata")
_journal_mode: ContextVar[str] = ContextVar("journal_mode", default="reflection")


def set_request_context(
    google_access_token: str | None = None,
    user_timezone: str | None = None,
    journal_mode: str | None = None,
) -> None:
    _google_access_token.set(google_access_token)
    if user_timezone:
        _user_timezone.set(user_timezone)
    if journal_mode:
        _journal_mode.set(journal_mode)


def clear_request_context() -> None:
    _google_access_token.set(None)


def get_google_access_token() -> str | None:
    return _google_access_token.get()


def get_user_timezone() -> str:
    return _user_timezone.get()


def get_journal_mode() -> str:
    return _journal_mode.get()
