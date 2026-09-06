"""Google Calendar API — create events with the user's OAuth access token."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"


def _parse_datetime(value: str, tz_name: str) -> datetime:
    text = value.strip()
    tz = ZoneInfo(tz_name)

    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return datetime.strptime(text, "%Y-%m-%d").replace(
            hour=9, minute=0, tzinfo=tz
        )

    normalized = text.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M"):
            try:
                dt = datetime.strptime(text, fmt)
                break
            except ValueError:
                continue
        else:
            raise ValueError(
                f"Could not parse datetime '{value}'. Use ISO format like 2026-09-10 or 2026-09-10 14:30."
            )

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)
    return dt


def create_calendar_event(
    access_token: str,
    title: str,
    start_datetime: str,
    end_datetime: str | None = None,
    description: str = "",
    timezone: str = "Asia/Kolkata",
    duration_minutes: int = 30,
) -> dict[str, str]:
    """Create a Google Calendar event on the user's primary calendar."""
    if not access_token:
        raise ValueError(
            "Google Calendar access not granted. Sign out and sign in again to allow calendar access."
        )

    clean_title = title.strip()[:200]
    if not clean_title:
        raise ValueError("Event title is required.")

    start = _parse_datetime(start_datetime, timezone)
    if end_datetime:
        end = _parse_datetime(end_datetime, timezone)
    else:
        end = start + timedelta(minutes=max(duration_minutes, 15))

    if end <= start:
        end = start + timedelta(minutes=max(duration_minutes, 15))

    all_day = re.fullmatch(r"\d{4}-\d{2}-\d{2}", start_datetime.strip())
    if all_day:
        start_body = {"date": start.strftime("%Y-%m-%d")}
        # Google Calendar all-day events use exclusive end date (next day).
        end_body = {"date": (start + timedelta(days=1)).strftime("%Y-%m-%d")}
    else:
        start_body = {"dateTime": start.isoformat(), "timeZone": timezone}
        end_body = {"dateTime": end.isoformat(), "timeZone": timezone}

    body = {
        "summary": clean_title,
        "description": description.strip()[:2000],
        "start": start_body,
        "end": end_body,
    }

    req = urllib.request.Request(
        CALENDAR_EVENTS_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        if exc.code == 401:
            raise ValueError(
                "Calendar permission expired. Sign out and sign in again to reconnect Google Calendar."
            ) from exc
        if exc.code == 403:
            raise ValueError(
                "Calendar API access denied. Enable Google Calendar API in your GCP project "
                "and grant calendar.events scope on sign-in."
            ) from exc
        raise ValueError(f"Google Calendar error ({exc.code}): {detail[:300]}") from exc

    return {
        "status": "created",
        "event_id": data.get("id", ""),
        "html_link": data.get("htmlLink", ""),
        "title": clean_title,
        "start": start_datetime,
        "end": end_datetime or end.isoformat(),
    }
