"""Function tools for LifeLens ADK agents."""

from __future__ import annotations

from app.datetime_context import build_datetime_context
from app.request_context import get_user_timezone

PROMPT_LIBRARY: dict[str, list[str]] = {
    "general": [
        "What felt most meaningful today, and why?",
        "What is one thing you are grateful for right now?",
        "What would you like to let go of from today?",
    ],
    "work": [
        "What energized you at work today?",
        "What friction did you notice, and what might it be teaching you?",
        "What is one small win you want to acknowledge?",
    ],
    "relationships": [
        "Who made you feel seen recently?",
        "Is there a conversation you wish had gone differently?",
        "How do you want to show up for someone important to you?",
    ],
    "goals": [
        "What progress did you make toward something that matters?",
        "What is blocking you, and what is one tiny next step?",
        "What would success look like one week from now?",
    ],
}


def get_current_datetime() -> dict[str, str]:
    """Return the user's current local date and time for resolving relative dates.

    Call this before interpreting "yesterday", "tomorrow", "last Friday", scheduling,
    or stamping journal archives.

    Returns:
        Structured temporal reference in the user's timezone.
    """
    tz = get_user_timezone()
    ctx = build_datetime_context(tz)
    return {
        "status": "ok",
        "timezone": ctx["timezone"],
        "now_iso": ctx["now_iso"],
        "date": ctx["date"],
        "time": ctx["time"],
        "day_of_week": ctx["day_of_week"],
        "human": ctx["human"],
        "yesterday": ctx["yesterday"],
        "yesterday_day": ctx["yesterday_day"],
        "tomorrow": ctx["tomorrow"],
        "tomorrow_day": ctx["tomorrow_day"],
    }


def suggest_reflection_prompts(topic: str = "general") -> dict[str, list[str] | str]:
    """Return curated journaling prompts for a topic area.

    Args:
        topic: One of general, work, relationships, or goals.

    Returns:
        A dict with the resolved topic and a list of prompt strings.
    """
    key = topic.strip().lower()
    if key not in PROMPT_LIBRARY:
        key = "general"
    return {"topic": key, "prompts": PROMPT_LIBRARY[key]}


def format_bullet_summary(points: list[str]) -> str:
    """Format bullet points into a clean journal summary block.

    Args:
        points: Short summary lines to include.

    Returns:
        A markdown-style bullet list string.
    """
    cleaned = [p.strip() for p in points if p and p.strip()]
    if not cleaned:
        return "No summary points provided."
    return "\n".join(f"- {line}" for line in cleaned)


def prepare_journal_archive(title: str, summary: str) -> dict[str, str]:
    """Signal that the current conversation should be archived to the user's journal.

    Args:
        title: Short title for the archive entry (max 120 chars).
        summary: One or two sentence summary of the conversation themes.

    Returns:
        Archive metadata for the client to persist the full chat.
    """
    clean_title = title.strip()[:120] or "Journal entry"
    clean_summary = summary.strip()[:500] or "Saved conversation"
    ctx = build_datetime_context(get_user_timezone())
    return {
        "action": "archive",
        "title": clean_title,
        "summary": clean_summary,
        "archived_at": ctx["date"],
        "archived_at_human": ctx["human"],
        "timezone": ctx["timezone"],
    }


def create_calendar_event(
    title: str,
    start_datetime: str,
    end_datetime: str = "",
    description: str = "",
    duration_minutes: int = 30,
) -> dict[str, str]:
    """Create a Google Calendar event for the user.

    Use when the user mentions a date/time, asks to schedule something, set a reminder,
    or "mark on my calendar".

    Args:
        title: Event title (e.g. "Therapy reflection follow-up").
        start_datetime: Start as ISO date or datetime, e.g. "2026-09-10" or "2026-09-10 14:30".
        end_datetime: Optional end datetime; omit to use duration_minutes from start.
        description: Optional event notes from the conversation.
        duration_minutes: Default event length when end_datetime is omitted (default 30).

    Returns:
        Created event metadata including html_link.
    """
    from app.calendar_service import create_calendar_event as _create
    from app.request_context import get_google_access_token, get_user_timezone

    token = get_google_access_token()
    tz = get_user_timezone()
    end = end_datetime.strip() if end_datetime else None
    try:
        return _create(
            access_token=token or "",
            title=title,
            start_datetime=start_datetime,
            end_datetime=end,
            description=description,
            timezone=tz,
            duration_minutes=duration_minutes,
        )
    except Exception as exc:
        return {"status": "error", "error": str(exc)}
