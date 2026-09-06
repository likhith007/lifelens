"""Shared current date/time context for agents and calendar parsing."""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.agents.prompts import format_temporal_context


def _resolve_timezone(timezone: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def build_datetime_context(timezone: str = "Asia/Kolkata") -> dict[str, str]:
    """Return a structured snapshot of the user's current local time."""
    tz = _resolve_timezone(timezone)
    now = datetime.now(tz)
    yesterday = now - timedelta(days=1)
    tomorrow = now + timedelta(days=1)

    return {
        "timezone": timezone,
        "now_iso": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M"),
        "day_of_week": now.strftime("%A"),
        "human": now.strftime("%A, %B %d, %Y at %I:%M %p"),
        "yesterday": yesterday.strftime("%Y-%m-%d"),
        "yesterday_day": yesterday.strftime("%A"),
        "tomorrow": tomorrow.strftime("%Y-%m-%d"),
        "tomorrow_day": tomorrow.strftime("%A"),
    }


def format_datetime_preamble(timezone: str = "Asia/Kolkata") -> str:
    """Compact block prepended to user messages so agents know 'now'."""
    return format_temporal_context(**build_datetime_context(timezone))
