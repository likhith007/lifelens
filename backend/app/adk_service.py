"""Google ADK runner for LifeLens — shared sessions + streaming."""

import os
from contextlib import aclosing
from typing import Any, AsyncIterator

from google.adk.artifacts.in_memory_artifact_service import InMemoryArtifactService
from google.adk.events.event import Event
from google.adk.memory.in_memory_memory_service import InMemoryMemoryService
from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.genai import types

from app.agents.lifelens_agent import AGENT_NAME, create_lifelens_agent
from app.agents.prompts import (
    JOURNAL_MODE_PREAMBLES,
    SUMMARIZE_SESSION_PREAMBLE,
    format_temporal_context,
)
from app.datetime_context import build_datetime_context
from app.request_context import clear_request_context, set_request_context
from app.secrets import get_gemini_api_key

APP_NAME = "lifelens"

MODEL_FALLBACK_LADDER = [
    "gemini-3.6-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-3.7-flash",
]

RECOVERABLE_MARKERS = (
    "UNAVAILABLE",
    "RESOURCE_EXHAUSTED",
    "NOT_FOUND",
    "INTERNAL",
    "503",
    "429",
    "404",
    "500",
)

# Shared across requests so ADK retains multi-turn context per session_id.
_session_service = InMemorySessionService()
_artifact_service = InMemoryArtifactService()
_memory_service = InMemoryMemoryService()


def _ensure_gemini_env() -> None:
    if os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"):
        return
    os.environ["GOOGLE_API_KEY"] = get_gemini_api_key()


def _is_recoverable(error: Exception) -> bool:
    message = str(error).upper()
    return any(marker in message for marker in RECOVERABLE_MARKERS)


def _get_runner(model: str) -> Runner:
    return Runner(
        app_name=APP_NAME,
        agent=create_lifelens_agent(model),
        session_service=_session_service,
        artifact_service=_artifact_service,
        memory_service=_memory_service,
        auto_create_session=True,
    )


def _extract_event_text(event: Event) -> str:
    if not event.content or not event.content.parts:
        return ""
    return "".join(part.text for part in event.content.parts if part.text)


def _extract_tool_payloads(event: Event) -> list[dict[str, object]]:
    """Read ADK function/tool responses from stream events."""
    payloads: list[dict[str, object]] = []
    if not event.content or not event.content.parts:
        return payloads

    for part in event.content.parts:
        if part.function_response:
            data = part.function_response.response
            if isinstance(data, dict):
                payloads.append(
                    {
                        "name": part.function_response.name or "function",
                        "data": data,
                    }
                )
        if part.tool_response and isinstance(part.tool_response.response, dict):
            payloads.append({"name": "tool", "data": part.tool_response.response})
    return payloads


async def _bootstrap_session(
    runner: Runner,
    user_id: str,
    session_id: str,
    history: list[dict[str, str]],
) -> None:
    """Seed an ADK session from Firestore history when the server has no memory."""
    if not history:
        return

    existing = await runner.session_service.get_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )
    if existing and existing.events:
        return

    session = existing
    if session is None:
        session = await runner.session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id,
        )

    for item in history:
        is_user = item["role"] == "user"
        author = "user" if is_user else AGENT_NAME
        content = types.Content(
            role="user" if is_user else "model",
            parts=[types.Part(text=item["content"])],
        )
        event = Event(author=author, content=content)
        await runner.session_service.append_event(session=session, event=event)



async def stream_with_adk(
    user_id: str,
    message: str,
    session_id: str,
    history: list[dict[str, str]] | None = None,
    bootstrap: bool = False,
    google_access_token: str | None = None,
    user_timezone: str = "Asia/Kolkata",
    intent: str = "chat",
    journal_mode: str = "reflection",
) -> AsyncIterator[dict[str, Any]]:
    """Stream ADK agent events for a multi-turn session."""
    _ensure_gemini_env()
    history = history or []

    set_request_context(
        google_access_token=google_access_token,
        user_timezone=user_timezone,
        journal_mode=journal_mode,
    )

    temporal_preamble = format_temporal_context(**build_datetime_context(user_timezone))
    intent_block = f"{SUMMARIZE_SESSION_PREAMBLE}\n\n" if intent == "summarize_session" else ""
    mode_block = (
        JOURNAL_MODE_PREAMBLES.get(journal_mode, JOURNAL_MODE_PREAMBLES["reflection"])
        + "\n"
    )
    if intent == "summarize_session":
        mode_block = ""
    augmented_message = (
        f"{temporal_preamble}\n\n{mode_block}{intent_block}User message:\n{message}"
    )
    new_message = types.UserContent(parts=[types.Part(text=augmented_message)])

    last_error: Exception | None = None

    try:
        for model in MODEL_FALLBACK_LADDER:
            try:
                runner = _get_runner(model)
                if bootstrap and history:
                    await _bootstrap_session(runner, user_id, session_id, history)

                emitted_len = 0
                full_text = ""

                async with aclosing(
                    runner.run_async(
                        user_id=user_id,
                        session_id=session_id,
                        new_message=new_message,
                    )
                ) as stream:
                    async for event in stream:
                        for tool_payload in _extract_tool_payloads(event):
                            name = str(tool_payload.get("name", ""))
                            data = tool_payload.get("data") or {}
                            if name == "create_calendar_event":
                                if data.get("status") == "error":
                                    yield {
                                        "type": "calendar",
                                        "status": "error",
                                        "message": str(
                                            data.get("error", "Calendar event failed")
                                        ),
                                    }
                                elif data.get("status") == "created" or data.get("html_link"):
                                    yield {"type": "calendar", "status": "created", **data}

                        if event.author in ("user", "User"):
                            continue
                        text = _extract_event_text(event)
                        if not text:
                            continue

                        if event.partial:
                            full_text = text
                        else:
                            full_text = text

                        if len(full_text) > emitted_len:
                            yield {"type": "delta", "text": full_text[emitted_len:]}
                            emitted_len = len(full_text)

                if not full_text.strip():
                    raise RuntimeError("Empty response from ADK agent")

                yield {"type": "complete", "reply": full_text, "model": model}
                return
            except Exception as exc:
                last_error = exc
                if not _is_recoverable(exc):
                    raise

        raise last_error or RuntimeError("All ADK models unavailable")
    finally:
        clear_request_context()


async def generate_with_adk(
    user_id: str,
    message: str,
    history: list[dict[str, str]] | None = None,
    interaction_id: str | None = None,
    bootstrap: bool = False,
) -> tuple[str, str]:
    """Non-streaming fallback — collects the full streamed reply."""
    session_id = interaction_id or "new-reflection"
    reply = ""
    model = MODEL_FALLBACK_LADDER[0]
    async for chunk in stream_with_adk(
        user_id=user_id,
        message=message,
        session_id=session_id,
        history=history,
        bootstrap=bootstrap,
    ):
        if chunk["type"] == "delta":
            reply += chunk["text"]
        elif chunk["type"] == "complete":
            reply = chunk["reply"]
            model = chunk["model"]
    return reply, model
