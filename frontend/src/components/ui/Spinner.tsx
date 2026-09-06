interface SpinnerProps {
  label?: string;
  variant?: "default" | "light";
}

export function Spinner({ label, variant = "default" }: SpinnerProps) {
  const isLight = variant === "light";

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`h-8 w-8 animate-spin rounded-full border-2 ${
          isLight
            ? "border-white/20 border-t-white"
            : "border-line border-t-accent"
        }`}
        role="status"
        aria-label="Loading"
      />
      {label && (
        <p className={`text-sm ${isLight ? "text-white/60" : "text-ink-muted"}`}>
          {label}
        </p>
      )}
    </div>
  );
}
