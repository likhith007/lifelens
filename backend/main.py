import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.adk_service import stream_with_adk
from app.auth import verify_bearer_token
from app.gemini import generate_with_adk
from app.schemas import (
    CalendarEventRequest,
    CalendarFromMessageRequest,
    ChatRequest,
    ChatResponse,
    StreamChatRequest,
    TranscribeResponse,
)
from app.calendar_extract import extract_calendar_event
from app.calendar_service import create_calendar_event
from app.speech_service import synthesize_speech_wav, transcribe_audio

load_dotenv()

app = FastAPI(title="LifeLens API", version="1.0.0")

allowed_origins = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_current_user(authorization: str | None = Header(default=None)) -> str:
    try:
        return verify_bearer_token(authorization)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    uid: str = Depends(get_current_user),
) -> ChatResponse:
    history = [{"role": m.role, "content": m.content} for m in payload.history]
    session_id = payload.interaction_id or "new-reflection"
    try:
        reply, model = await generate_with_adk(
            user_id=uid,
            message=payload.message,
            history=history,
            interaction_id=session_id,
            bootstrap=payload.bootstrap,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return ChatResponse(reply=reply, model=model)


@app.post("/api/chat/stream")
async def chat_stream(
    payload: StreamChatRequest,
    uid: str = Depends(get_current_user),
) -> StreamingResponse:
    history = [{"role": m.role, "content": m.content} for m in payload.history]

    async def event_generator():
        reply = ""
        try:
            async for chunk in stream_with_adk(
                user_id=uid,
                message=payload.message,
                session_id=payload.session_id,
                history=history,
                bootstrap=payload.bootstrap,
                google_access_token=payload.google_access_token,
                user_timezone=payload.user_timezone,
                intent=payload.intent,
                journal_mode=payload.journal_mode,
            ):
                if chunk.get("type") == "complete":
                    reply = chunk.get("reply", "")
                yield f"data: {json.dumps(chunk)}\n\n"

            if payload.speak and reply.strip():
                pass  # TTS handled on frontend, synced to streamed text
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/calendar/events")
async def calendar_create_event(
    payload: CalendarEventRequest,
    uid: str = Depends(get_current_user),
) -> dict[str, str]:
    try:
        return create_calendar_event(
            access_token=payload.google_access_token,
            title=payload.title,
            start_datetime=payload.start_datetime,
            end_datetime=payload.end_datetime,
            description=payload.description,
            timezone=payload.user_timezone,
            duration_minutes=payload.duration_minutes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/calendar/create-from-message")
async def calendar_create_from_message(
    payload: CalendarFromMessageRequest,
    uid: str = Depends(get_current_user),
) -> dict[str, str]:
    try:
        extracted = extract_calendar_event(payload.message, payload.user_timezone)
        return create_calendar_event(
            access_token=payload.google_access_token,
            title=extracted["title"],
            start_datetime=extracted["start_datetime"],
            description=extracted.get("description", ""),
            timezone=payload.user_timezone,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/speech/transcribe", response_model=TranscribeResponse)
async def speech_transcribe(
    audio: UploadFile = File(...),
    uid: str = Depends(get_current_user),
) -> TranscribeResponse:
    if not audio.content_type or not audio.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="Expected an audio file")
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio")
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio too large (max 10MB)")
    try:
        text = await transcribe_audio(data, audio.content_type)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return TranscribeResponse(text=text)


@app.post("/api/speech/tts")
async def speech_tts(
    payload: dict,
    uid: str = Depends(get_current_user),
) -> StreamingResponse:
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    try:
        wav = await synthesize_speech_wav(text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return StreamingResponse(
        iter([wav]),
        media_type="audio/wav",
        headers={"Cache-Control": "no-store"},
    )


STATIC_DIR = Path(__file__).resolve().parent / "static"

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Frontend not built")
