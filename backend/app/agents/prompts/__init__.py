"""LifeLens system prompts — all agent and runtime prompt text lives here."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent

# Agent names (referenced in coordinator routing prompts)
COORDINATOR_NAME = "lifelens_coordinator"
DATETIME_AGENT_NAME = "datetime_agent"
REFLECTION_AGENT_NAME = "reflection_agent"
ARCHIVE_AGENT_NAME = "archive_agent"
CALENDAR_AGENT_NAME = "calendar_agent"
SUMMARY_AGENT_NAME = "summary_agent"
BRAINSTORM_AGENT_NAME = "brainstorm_agent"

# Used when bootstrapping Firestore history into an ADK session.
AGENT_NAME = COORDINATOR_NAME


@lru_cache(maxsize=32)
def _load_raw(name: str) -> str:
    path = _PROMPTS_DIR / f"{name}.txt"
    return path.read_text(encoding="utf-8").strip()


@lru_cache(maxsize=1)
def shared_rules() -> str:
    return _load_raw("shared_rules")


def agent_instruction(name: str) -> str:
    """Load an agent system prompt with shared rules injected."""
    return _load_raw(name).format(shared_rules=shared_rules())


def coordinator_instruction() -> str:
    return _load_raw("coordinator").format(
        reflection_agent=REFLECTION_AGENT_NAME,
        brainstorm_agent=BRAINSTORM_AGENT_NAME,
        datetime_agent=DATETIME_AGENT_NAME,
        archive_agent=ARCHIVE_AGENT_NAME,
        calendar_agent=CALENDAR_AGENT_NAME,
        summary_agent=SUMMARY_AGENT_NAME,
        shared_rules=shared_rules(),
    )


SUMMARIZE_SESSION_PREAMBLE = _load_raw("summarize_session")

JOURNAL_MODE_PREAMBLES: dict[str, str] = {
    "reflection": _load_raw("journal_mode_reflection"),
    "brainstorm": _load_raw("journal_mode_brainstorm"),
}


def format_temporal_context(**ctx: str) -> str:
    """Format the temporal context block prepended to each chat message."""
    return _load_raw("temporal_context").format(**ctx)


def format_calendar_extract_prompt(message: str, **ctx: str) -> str:
    """Format the Gemini prompt for natural-language calendar extraction."""
    return _load_raw("calendar_extract").format(message=message.strip(), **ctx)
