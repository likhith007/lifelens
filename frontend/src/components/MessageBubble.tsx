import type { ChatMessage } from "@/lib/firestore";
import { ThinkingIndicator } from "./ThinkingIndicator";

interface MessageBubbleProps {
  message: ChatMessage & { id?: string };
  streaming?: boolean;
  speaking?: boolean;
  preparing?: boolean;
}

export function MessageBubble({ message, streaming, speaking, preparing }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const showThinking =
    (streaming || preparing) && !message.content.trim() && !isUser;

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[80%] sm:max-w-[70%]">
          <p className="mb-1.5 text-right text-[11px] font-medium tracking-wide text-ink-faint uppercase">
            You
          </p>
          <div className="rounded-2xl rounded-br-md bg-ink px-5 py-3.5 text-[15px] leading-relaxed text-white">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="max-w-[90%] sm:max-w-[80%]">
        <p className="mb-1.5 text-[11px] font-medium tracking-wide text-ink-faint uppercase">
          LifeLens {speaking && <span className="normal-case text-accent">· speaking</span>}
        </p>
        <div className="rounded-2xl rounded-bl-md border border-line bg-surface-elevated px-5 py-3.5 shadow-soft">
          {showThinking ? (
            <ThinkingIndicator
              label={preparing ? "Preparing voice response…" : undefined}
            />
          ) : (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">
              {message.content}
              {streaming && (
                <span className="ml-0.5 inline-block h-[1.1em] w-0.5 animate-pulse-soft bg-accent align-middle" />
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
