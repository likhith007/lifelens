interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "light";
}

const sizes = {
  sm: { mark: "h-7 w-7", text: "text-base" },
  md: { mark: "h-8 w-8", text: "text-lg" },
  lg: { mark: "h-10 w-10", text: "text-xl" },
};

export function Logo({ size = "md", variant = "default" }: LogoProps) {
  const s = sizes[size];
  const isLight = variant === "light";

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`${s.mark} flex items-center justify-center rounded-full ${
          isLight ? "bg-white/10 ring-1 ring-white/20" : "bg-accent ring-1 ring-accent/20"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`h-[55%] w-[55%] ${isLight ? "text-white" : "text-white"}`}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M12 2v3M12 19v3M2 12h3M19 12h3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span
        className={`font-serif ${s.text} tracking-tight ${
          isLight ? "text-white" : "text-ink"
        }`}
      >
        LifeLens
      </span>
    </div>
  );
}
