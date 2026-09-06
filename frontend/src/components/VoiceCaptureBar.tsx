export type VoiceUiState = "idle" | "recording" | "processing";

interface VoiceCaptureBarProps {
  state: VoiceUiState;
  disabled?: boolean;
  isThinking?: boolean;
  isSpeaking?: boolean;
  voiceMode: boolean;
  onToggleRecord: () => void;
  onToggleType?: () => void;
}

export function VoiceCaptureBar({
  state,
  disabled,
  isThinking,
  isSpeaking,
  voiceMode,
  onToggleRecord,
  onToggleType,
}: VoiceCaptureBarProps) {
  const isRecording = state === "recording";
  const isProcessing = state === "processing";

  const statusText = isSpeaking
    ? "LifeLens is speaking…"
    : isThinking
      ? "Reflecting on what you shared…"
      : isProcessing
        ? "Turning your voice into text…"
        : isRecording
          ? "Recording — tap to stop and send"
          : voiceMode
            ? "Tap the mic to start speaking"
            : "Type or switch to voice";

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <p className="text-center text-sm text-ink-muted">{statusText}</p>

      <div className="relative flex items-center justify-center">
        {isRecording && (
          <span className="absolute h-24 w-24 animate-ping rounded-full bg-accent/25" />
        )}
        <button
          type="button"
          disabled={disabled || isProcessing || isSpeaking}
          onClick={onToggleRecord}
          className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-200 ${
            isRecording
              ? "scale-110 bg-red-500 text-white shadow-float"
              : "bg-ink text-white shadow-card hover:bg-accent"
          } disabled:opacity-40 disabled:hover:scale-100`}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          {isProcessing ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : isRecording ? (
            <StopIcon />
          ) : (
            <MicIcon />
          )}
        </button>
      </div>

      {onToggleType && (
        <button
          type="button"
          onClick={onToggleType}
          className="text-xs text-ink-faint underline-offset-2 hover:text-ink-muted hover:underline"
        >
          {voiceMode ? "Switch to typing" : "Switch to voice"}
        </button>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" />
      <path strokeLinecap="round" d="M19 10v1a7 7 0 01-14 0v-1M12 18v3" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
