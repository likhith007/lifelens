import { useRotatingMessage } from "@/hooks/useRotatingMessage";

interface ThinkingIndicatorProps {
  label?: string;
}

export function ThinkingIndicator({ label }: ThinkingIndicatorProps) {
  const rotating = useRotatingMessage(!label);
  const text = label ?? rotating;

  return (
    <div className="flex items-center gap-3 py-0.5">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-accent/50 animate-pulse-soft"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </span>
      <p
        key={text}
        className="text-[15px] italic text-ink-muted animate-fade-in"
        aria-live="polite"
      >
        {text}
      </p>
    </div>
  );
}
