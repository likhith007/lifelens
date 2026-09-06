"""Extract structured calendar events from natural language."""

from __future__ import annotations

import json
import os
import re

from google import genai

from app.datetime_context import build_datetime_context
from app.agents.prompts import format_calendar_extract_prompt
from app.secrets import get_gemini_api_key


def _client() -> genai.Client:
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or get_gemini_api_key()
    return genai.Client(api_key=api_key)


def extract_calendar_event(message: str, timezone: str = "Asia/Kolkata") -> dict[str, str]:
    """Use Gemini to pull title and start datetime from a user message."""
    ctx = build_datetime_context(timezone)
    prompt = format_calendar_extract_prompt(message, **ctx)

    client = _client()
    models = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-2.0-flash-lite"]
    last_error: Exception | None = None
    text = ""
    for model in models:
        try:
            response = client.models.generate_content(model=model, contents=prompt)
            text = (response.text or "").strip()
            if text:
                break
        except Exception as exc:
            last_error = exc
            continue
    if not text:
        raise ValueError(
            f"Could not parse calendar details: {last_error or 'model unavailable'}"
        )
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("Could not understand the date or time. Try: 'Remind me tomorrow at 9am to journal'.")

    data = json.loads(match.group())
    title = str(data.get("title", "")).strip()
    start = str(data.get("start_datetime", "")).strip()
    description = str(data.get("description", "")).strip()

    if not title or not start:
        raise ValueError("Could not extract a calendar title and date from your message.")

    return {
        "title": title[:200],
        "start_datetime": start,
        "description": description[:2000],
    }
