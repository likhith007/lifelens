"""Gemini speech-to-text and text-to-speech for LifeLens."""

import asyncio
import io
import os
import wave
from typing import AsyncIterator

from google import genai
from google.genai import types

from app.secrets import get_gemini_api_key

STT_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-3.7-flash",
]
TTS_MODELS = [
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts",
    "gemini-3.1-flash-tts-preview",
]
TTS_VOICE = "Kore"
TTS_SAMPLE_RATE = 24000


def _ensure_gemini_env() -> None:
    if os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"):
        return
    os.environ["GOOGLE_API_KEY"] = get_gemini_api_key()


def _client() -> genai.Client:
    _ensure_gemini_env()
    return genai.Client()


def _pcm_to_wav(pcm: bytes, rate: int = TTS_SAMPLE_RATE) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(pcm)
    return buf.getvalue()


def _extract_pcm(response) -> bytes:
    parts = response.candidates[0].content.parts
    for part in parts:
        if part.inline_data and part.inline_data.data:
            return part.inline_data.data
    raise RuntimeError("No audio in TTS response")


def _synthesize_sync(text: str) -> bytes:
    """Generate WAV audio for assistant reply (blocking)."""
    client = _client()
    prompt = (
        "Speak warmly and calmly as a thoughtful journaling companion. "
        f"Say naturally: {text}"
    )
    last_error: Exception | None = None

    for model in TTS_MODELS:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=TTS_VOICE,
                            )
                        )
                    ),
                ),
            )
            return _pcm_to_wav(_extract_pcm(response))
        except Exception as exc:
            last_error = exc

    raise last_error or RuntimeError("TTS unavailable")


def _transcribe_sync(audio_bytes: bytes, mime_type: str) -> str:
    client = _client()
    contents = [
        types.Content(
            parts=[
                types.Part(
                    inline_data=types.Blob(mime_type=mime_type, data=audio_bytes)
                ),
                types.Part(
                    text=(
                        "Transcribe the spoken words in this audio exactly. "
                        "Return only the transcription, no commentary."
                    )
                ),
            ]
        )
    ]
    last_error: Exception | None = None

    for model in STT_MODELS:
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
            )
            text = (response.text or "").strip()
            if text:
                return text
            raise RuntimeError("Could not transcribe audio")
        except Exception as exc:
            last_error = exc
            if "NOT_FOUND" not in str(exc).upper() and "404" not in str(exc):
                raise

    raise last_error or RuntimeError("Speech transcription unavailable")


async def transcribe_audio(audio_bytes: bytes, mime_type: str) -> str:
    return await asyncio.to_thread(_transcribe_sync, audio_bytes, mime_type)


async def synthesize_speech_wav(text: str) -> bytes:
    cleaned = text.strip()
    if not cleaned:
        raise ValueError("Empty text for TTS")
    return await asyncio.to_thread(_synthesize_sync, cleaned[:4000])


async def stream_tts_wav_chunks(text: str, chunk_size: int = 8192) -> AsyncIterator[bytes]:
    wav = await synthesize_speech_wav(text)
    for i in range(0, len(wav), chunk_size):
        yield wav[i : i + chunk_size]
