from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=50)
    interaction_id: str | None = Field(default=None, max_length=128)
    bootstrap: bool = False


class StreamChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    session_id: str = Field(min_length=1, max_length=128)
    history: list[ChatMessage] = Field(default_factory=list, max_length=50)
    bootstrap: bool = False
    speak: bool = True
    google_access_token: str | None = Field(default=None, max_length=4096)
    user_timezone: str = Field(default="Asia/Kolkata", max_length=64)
    intent: Literal["chat", "summarize_session"] = "chat"
    journal_mode: Literal["reflection", "brainstorm"] = "reflection"


class TranscribeResponse(BaseModel):
    text: str


class ChatResponse(BaseModel):
    reply: str
    model: str


class CalendarEventRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    start_datetime: str = Field(min_length=8, max_length=64)
    end_datetime: str | None = Field(default=None, max_length=64)
    description: str = Field(default="", max_length=2000)
    google_access_token: str = Field(min_length=10, max_length=4096)
    user_timezone: str = Field(default="Asia/Kolkata", max_length=64)
    duration_minutes: int = Field(default=30, ge=15, le=480)


class CalendarFromMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    google_access_token: str = Field(min_length=10, max_length=4096)
    user_timezone: str = Field(default="Asia/Kolkata", max_length=64)
