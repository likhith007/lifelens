import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { MessageBubble } from "./MessageBubble";
import { ErrorBanner } from "./ErrorBanner";
import { VoiceCaptureBar } from "./VoiceCaptureBar";
import { useRotatingMessage } from "@/hooks/useRotatingMessage";
import { useToggleVoiceRecorder } from "@/hooks/useToggleVoiceRecorder";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useSyncedVoiceResponse } from "@/hooks/useSyncedVoiceResponse";
import type { Interaction, ChatMessage } from "@/lib/firestore";
import {
  createInteractionWithId,
  listMessages,
  markInteractionArchived,
  saveSessionMessages,
} from "@/lib/firestore";
import { formatFirestoreError } from "@/lib/firestore-errors";
import { isSaveToJournalIntent } from "@/lib/journal-intent";
import { isCalendarIntent } from "@/lib/calendar-intent";
import type { JournalMode } from "@/lib/nav-features";
import { JOURNAL_MODES, SUMMARIZE_SESSION_PROMPT } from "@/lib/nav-features";

interface JournalEditorProps {
  interaction: Interaction | null;
  journalMode: JournalMode;
  onInteractionCreated: (id: string, title: string) => void;
  onArchived: () => void;
}

function newSessionId(): string {
  return crypto.randomUUID();
}

function parseApiError(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as { detail?: string; error?: string; message?: string };
    return d.detail ?? d.message ?? d.error ?? "Failed to get AI response";
  }
  return "Failed to get AI response";
}

export function JournalEditor({
  interaction,
  journalMode,
  onInteractionCreated,
  onArchived,
}: JournalEditorProps) {
  const { user, getIdToken, getGoogleAccessToken, connectGoogleCalendar } = useAuth();
  const [messages, setMessages] = useState<(ChatMessage & { id?: string })[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveNotice, setArchiveNotice] = useState<string | null>(null);
  const [calendarNotice, setCalendarNotice] = useState<{
    type: "success" | "error";
    message: string;
    link?: string;
  } | null>(null);
  const [voiceMode, setVoiceMode] = useState(true);
  const [voicePhase, setVoicePhase] = useState<"reflecting" | "preparing" | "speaking" | null>(
    null
  );

  const { playing: isSpeaking, playBlob, stop: stopAudio, waitForQueue } =
    useAudioPlayback();
  const {
    recording,
    processing: voiceProcessing,
    setProcessing: setVoiceProcessing,
    start: startRecording,
    stop: stopRecording,
  } = useToggleVoiceRecorder();

  const sessionIdRef = useRef(interaction?.id ?? newSessionId());
  const savedCountRef = useRef(0);
  const needsBootstrapRef = useRef(false);
  const messagesRef = useRef(messages);
  const interactionIdRef = useRef<string | null>(interaction?.id ?? null);
  const persistInFlightRef = useRef(false);
  const voiceModeRef = useRef(voiceMode);
  voiceModeRef.current = voiceMode;

  messagesRef.current = messages;

  const updateAssistantText = useCallback((content: string) => {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === "assistant") {
        next[next.length - 1] = { ...last, content };
      }
      return next;
    });
  }, []);

  const fetchTts = useCallback(
    async (text: string): Promise<Blob> => {
      const token = await getIdToken();
      if (!token) throw new Error("Authentication expired.");
      const res = await fetch("/api/speech/tts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Could not generate speech");
      return res.blob();
    },
    [getIdToken]
  );

  const syncedVoice = useSyncedVoiceResponse({
    fetchTts,
    onVisibleText: updateAssistantText,
    playAudio: playBlob,
    onPhaseChange: (phase) => {
      if (phase === "preparing") setVoicePhase("preparing");
      else if (phase === "speaking") setVoicePhase("speaking");
      else setVoicePhase(null);
    },
  });

  const archiveSession = useCallback(async (messagesToSave?: ChatMessage[]) => {
    if (!user) throw new Error("You must be signed in to save.");
    if (persistInFlightRef.current) {
      throw new Error("Save already in progress. Please wait.");
    }

    const currentMessages = messagesToSave ?? messagesRef.current;
    if (currentMessages.length === 0) {
      throw new Error("Nothing to save yet — start a conversation first.");
    }

    persistInFlightRef.current = true;
    try {
      const interactionId = interactionIdRef.current ?? sessionIdRef.current;
      const firstUser = currentMessages.find((m) => m.role === "user");
      const title =
        (firstUser?.content.slice(0, 60) ?? "Journal entry") +
        ((firstUser?.content.length ?? 0) > 60 ? "…" : "");
      const lastAssistant = [...currentMessages]
        .reverse()
        .find((m) => m.role === "assistant");
      const preview = lastAssistant?.content ?? currentMessages[currentMessages.length - 1].content;

      if (!interactionIdRef.current) {
        await createInteractionWithId(user.uid, interactionId, title, preview, true);
        interactionIdRef.current = interactionId;
      } else {
        await markInteractionArchived(user.uid, interactionId, preview);
      }

      const savedTotal = await saveSessionMessages(
        user.uid,
        interactionId,
        currentMessages,
        savedCountRef.current
      );
      savedCountRef.current = savedTotal;

      messagesRef.current = currentMessages.map((m) => ({ ...m }));
      setMessages(currentMessages.map((m) => ({ ...m })));

      if (!interaction?.id) {
        onInteractionCreated(interactionId, title);
      }
      onArchived();
      setArchiveNotice(
        `Saved ${currentMessages.length} messages to your archives.`
      );
    } catch (err) {
      console.error("Failed to archive session:", err);
      throw new Error(formatFirestoreError(err));
    } finally {
      persistInFlightRef.current = false;
    }
  }, [user, interaction?.id, onInteractionCreated, onArchived]);

  const createCalendarFromMessage = useCallback(
    async (userContent: string): Promise<boolean> => {
      const token = await getIdToken();
      if (!token) throw new Error("Authentication expired.");

      let googleToken = await getGoogleAccessToken();
      if (!googleToken) {
        googleToken = await connectGoogleCalendar();
      }

      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/calendar/create-from-message", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userContent,
          google_access_token: googleToken,
          user_timezone: userTimezone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parseApiError(data));

      const link = (data as { html_link?: string }).html_link;
      const title = (data as { title?: string }).title ?? "Event";
      setCalendarNotice({
        type: "success",
        message: `Added "${title}" to your Google Calendar.`,
        link,
      });
      return true;
    },
    [getIdToken, getGoogleAccessToken, connectGoogleCalendar]
  );

  useEffect(() => {
    setError(null);
    setInput("");
    setArchiveNotice(null);

    if (interaction?.id) {
      sessionIdRef.current = interaction.id;
      interactionIdRef.current = interaction.id;
      savedCountRef.current = 0;
      needsBootstrapRef.current = false;

      if (!user) {
        setMessages([]);
        setLoadingHistory(false);
        return;
      }

      setLoadingHistory(true);
      listMessages(user.uid, interaction.id)
        .then((msgs) => {
          const loaded = msgs.map((m) => ({
            role: m.role,
            content: m.content,
            id: m.id,
          }));
          setMessages(loaded);
          messagesRef.current = loaded;
          savedCountRef.current = msgs.length;
          needsBootstrapRef.current = msgs.length > 0;
        })
        .catch((err) => setError(formatFirestoreError(err)))
        .finally(() => setLoadingHistory(false));
      return;
    }

    if (!interactionIdRef.current) {
      sessionIdRef.current = newSessionId();
      savedCountRef.current = 0;
      needsBootstrapRef.current = false;
      setMessages([]);
      messagesRef.current = [];
    }
    setLoadingHistory(false);
  }, [user, interaction?.id]);

  const modeMeta = JOURNAL_MODES.find((m) => m.id === journalMode)!;
  const journalModeRef = useRef(journalMode);
  journalModeRef.current = journalMode;
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const streamChat = useCallback(
    async (
      userContent: string,
      historyForBootstrap: ChatMessage[],
      bootstrap: boolean,
      speak: boolean,
      intent: "chat" | "summarize_session" = "chat"
    ): Promise<{ reply: string; calendarHandled: boolean }> => {
      const token = await getIdToken();
      if (!token) throw new Error("Authentication expired. Please sign in again.");

      const googleAccessToken = await getGoogleAccessToken();
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      if (speak) syncedVoice.reset();

      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userContent,
          session_id: sessionIdRef.current,
          history: historyForBootstrap,
          bootstrap,
          speak: false,
          google_access_token: googleAccessToken,
          user_timezone: userTimezone,
          intent,
          journal_mode: journalModeRef.current,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(parseApiError(data));
      }
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reply = "";
      let calendarHandled = false;

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      if (speak) setVoicePhase("reflecting");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;

          const payload = JSON.parse(line.slice(5).trim()) as {
            type: string;
            text?: string;
            reply?: string;
            message?: string;
            status?: string;
            html_link?: string;
            title?: string;
          };

          if (payload.type === "error") {
            throw new Error(payload.message ?? "Stream error");
          }
          if (payload.type === "calendar") {
            if (payload.status === "created") {
              calendarHandled = true;
              setCalendarNotice({
                type: "success",
                message: `Added "${payload.title ?? "event"}" to your Google Calendar.`,
                link: payload.html_link,
              });
            } else if (payload.status === "error") {
              setCalendarNotice({
                type: "error",
                message: payload.message ?? "Could not create calendar event.",
              });
            }
          }
          if (payload.type === "delta" && payload.text) {
            reply += payload.text;
            if (!speak) {
              updateAssistantText(reply);
            }
          }
          if (payload.type === "complete" && payload.reply) {
            reply = payload.reply;
            if (!speak) updateAssistantText(reply);
          }
        }
      }

      if (!reply.trim()) throw new Error("Empty response from agent");

      if (speak) {
        await syncedVoice.playSynced(reply);
        await waitForQueue();
        setVoicePhase(null);
      }

      return { reply, calendarHandled };
    },
    [getIdToken, getGoogleAccessToken, syncedVoice, updateAssistantText, waitForQueue]
  );

  const sendMessage = useCallback(
    async (userContent: string) => {
      if (!userContent.trim() || streaming || !user) return;

      setError(null);
      setArchiveNotice(null);
      setCalendarNotice(null);
      setStreaming(true);
      stopAudio();
      setVoicePhase(null);

      const historySnapshot = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const bootstrap = needsBootstrapRef.current;
      if (bootstrap) needsBootstrapRef.current = false;

      setMessages((prev) => [...prev, { role: "user", content: userContent }]);

      try {
        const { reply, calendarHandled } = await streamChat(
          userContent,
          historySnapshot,
          bootstrap,
          voiceModeRef.current
        );

        if (isCalendarIntent(userContent) && !calendarHandled) {
          try {
            await createCalendarFromMessage(userContent);
          } catch (calendarErr) {
            setCalendarNotice({
              type: "error",
              message:
                calendarErr instanceof Error
                  ? calendarErr.message
                  : "Could not add to Google Calendar. Sign out and sign in again to grant calendar access.",
            });
          }
        }

        if (isSaveToJournalIntent(userContent)) {
          const fullConversation: ChatMessage[] = [
            ...historySnapshot,
            { role: "user", content: userContent },
            { role: "assistant", content: reply },
          ];
          try {
            await archiveSession(fullConversation);
          } catch (archiveErr) {
            setError(
              archiveErr instanceof Error
                ? archiveErr.message
                : "Could not save to archives. Try again."
            );
          }
        }
      } catch (err) {
        setMessages((prev) => {
          const next = [...prev];
          if (next[next.length - 1]?.role === "assistant" && !next[next.length - 1]?.content) {
            next.pop();
          }
          return next.filter(
            (m) => !(m.role === "user" && m.content === userContent && !m.id)
          );
        });
        setError(
          err instanceof Error ? err.message : "Something went wrong. Please try again."
        );
      } finally {
        setStreaming(false);
        setVoicePhase(null);
      }
    },
    [user, streaming, messages, streamChat, stopAudio, archiveSession, createCalendarFromMessage]
  );

  const summarizeSession = useCallback(async () => {
    if (!user || streaming || messages.length < 2) return;

    setError(null);
    setArchiveNotice(null);
    setCalendarNotice(null);
    setStreaming(true);
    stopAudio();
    setVoicePhase(null);

    const historySnapshot = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Summarize this conversation" },
    ]);

    try {
      await streamChat(
        SUMMARIZE_SESSION_PROMPT,
        historySnapshot,
        false,
        voiceModeRef.current,
        "summarize_session"
      );
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        if (next[next.length - 1]?.role === "assistant" && !next[next.length - 1]?.content) {
          next.pop();
        }
        if (next[next.length - 1]?.role === "user" && next[next.length - 1]?.content === "Summarize this conversation") {
          next.pop();
        }
        return next;
      });
      setError(
        err instanceof Error ? err.message : "Could not summarize this session. Try again."
      );
    } finally {
      setStreaming(false);
      setVoicePhase(null);
    }
  }, [user, streaming, messages, streamChat, stopAudio]);

  const handleVoiceToggle = useCallback(async () => {
    if (streaming || isSpeaking || voiceProcessing) return;

    if (recording) {
      try {
        setVoiceProcessing(true);
        setError(null);
        const blob = await stopRecording();
        const token = await getIdToken();
        if (!token) throw new Error("Authentication expired.");

        const form = new FormData();
        form.append("audio", blob, "recording.webm");
        const res = await fetch("/api/speech/transcribe", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(parseApiError(data));
        const text = (data as { text: string }).text?.trim();
        if (!text) throw new Error("No speech detected.");
        await sendMessage(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Voice input failed");
      } finally {
        setVoiceProcessing(false);
      }
      return;
    }

    try {
      setError(null);
      await startRecording();
    } catch {
      setError("Microphone access is required for voice journaling.");
    }
  }, [
    recording,
    streaming,
    isSpeaking,
    voiceProcessing,
    stopRecording,
    startRecording,
    getIdToken,
    sendMessage,
    setVoiceProcessing,
  ]);

  const loading = streaming;
  const statusMessage = useRotatingMessage(
    voicePhase === "reflecting" ||
      (streaming && voiceMode && !isSpeaking) ||
      (streaming && !voiceMode)
  );
  const voiceUiState = voiceProcessing ? "processing" : recording ? "recording" : "idle";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    await sendMessage(trimmed);
  };

  return (
    <div className="flex h-full flex-col">
      {calendarNotice && (
        <div
          className={`mb-4 shrink-0 rounded-xl border px-4 py-3 text-sm ${
            calendarNotice.type === "success"
              ? "border-accent/20 bg-accent-light text-accent"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <p>{calendarNotice.message}</p>
          {calendarNotice.link && (
            <a
              href={calendarNotice.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block underline"
            >
              Open in Google Calendar
            </a>
          )}
        </div>
      )}

      {archiveNotice && (
        <div className="mb-4 shrink-0 rounded-xl border border-accent/20 bg-accent-light px-4 py-3 text-sm text-accent">
          {archiveNotice}
        </div>
      )}

      {error && (
        <div className="mb-4 shrink-0">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {messages.length >= 2 && (
        <div className="mb-4 flex shrink-0 justify-end px-2">
          <button
            type="button"
            onClick={() => void summarizeSession()}
            disabled={streaming || isSpeaking}
            className="rounded-xl border border-line bg-surface-elevated px-4 py-2 text-sm font-medium text-ink-secondary transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
          >
            Summarize session
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 px-2 py-4">
          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
              <p className="mt-4 text-sm text-ink-muted">Loading conversation…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center sm:py-28">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent-light">
                <svg
                  className="h-6 w-6 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                  />
                </svg>
              </div>
              <h3 className="font-serif text-2xl text-ink">
                {journalMode === "reflection" ? "Start reflecting" : "Start brainstorming"}
              </h3>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
                {modeMeta.description}
                {" "}
                Use the mic or type to begin. Say &ldquo;save this to my journal&rdquo; to archive,
                or use &ldquo;Summarize session&rdquo; to recap the full chat.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isLastAssistant =
                i === messages.length - 1 && msg.role === "assistant";
              const isTextStreaming = streaming && !voiceMode && isLastAssistant;
              const isVoiceReflecting =
                voiceMode && voicePhase === "reflecting" && isLastAssistant;

              return (
              <MessageBubble
                key={msg.id ?? i}
                message={msg}
                streaming={isTextStreaming || isVoiceReflecting}
                preparing={
                  voicePhase === "preparing" &&
                  isLastAssistant
                }
                speaking={
                  (voicePhase === "speaking" || isSpeaking) &&
                  isLastAssistant
                }
              />
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-line/60 bg-surface pt-2 pb-4">
        <div className="mx-auto max-w-3xl">
          <VoiceCaptureBar
            state={voiceUiState}
            disabled={loading}
            isThinking={loading && !isSpeaking}
            isSpeaking={isSpeaking}
            voiceMode={voiceMode}
            onToggleRecord={() => void handleVoiceToggle()}
            onToggleType={() => setVoiceMode((v) => !v)}
          />

          {!voiceMode && (
            <form onSubmit={handleSubmit} className="mt-2 px-1">
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    journalMode === "reflection"
                      ? "How was your day? Share what's on your mind…"
                      : "What would you like to brainstorm about?"
                  }
                  rows={3}
                  maxLength={8000}
                  disabled={loading || isSpeaking}
                  className="input-field pr-14"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={loading || isSpeaking || !input.trim()}
                  className="absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition-all duration-200 hover:bg-accent-hover disabled:opacity-30"
                  aria-label="Send"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </form>
          )}

          <p className="mt-2 text-center text-[11px] text-ink-faint">
            {voicePhase === "reflecting" || (loading && voiceMode && !isSpeaking) ? (
              <span className="italic text-ink-muted">{statusMessage}</span>
            ) : loading && !voiceMode ? (
              <span className="italic text-ink-muted">{statusMessage}</span>
            ) : voicePhase === "preparing" ? (
              <span className="italic text-ink-muted">Preparing voice response…</span>
            ) : isSpeaking || voicePhase === "speaking" ? (
              <span className="italic text-ink-muted">Playing response…</span>
            ) : voiceMode ? (
              "Tap mic to start · tap again to send"
            ) : (
              "Enter to send · Shift+Enter for new line"
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
