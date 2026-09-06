import type { Interaction } from "@/lib/firestore";

interface HistorySidebarProps {
  interactions: Interaction[];
  selectedId: string | null;
  onSelect: (interaction: Interaction) => void;
  onNewEntry: () => void;
  loading: boolean;
  isDraftActive?: boolean;
  onClose?: () => void;
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) return "Yesterday";
  if (days < 7) {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function HistorySidebar({
  interactions,
  selectedId,
  onSelect,
  onNewEntry,
  loading,
  isDraftActive = false,
  onClose,
}: HistorySidebarProps) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-surface-elevated">
      <div className="flex items-center justify-between border-b border-line px-4 py-4">
        <p className="text-[11px] font-medium tracking-[0.15em] text-ink-faint uppercase">
          Journal
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost !p-1.5 lg:hidden"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-3">
        <button
          type="button"
          onClick={onNewEntry}
          className={`w-full rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
            isDraftActive
              ? "bg-accent text-white shadow-soft"
              : "border border-line text-ink-secondary hover:border-line-strong hover:bg-surface-muted hover:text-ink"
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <PlusIcon />
            New reflection
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {loading ? (
          <div className="space-y-2 px-2 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-muted" />
            ))}
          </div>
        ) : interactions.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-ink-faint">
            No entries yet.
            <br />
            Start your first reflection.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {interactions.map((item) => {
              const isActive = selectedId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className={`group w-full rounded-xl px-3 py-3 text-left transition-all duration-150 ${
                      isActive
                        ? "bg-accent-light"
                        : "hover:bg-surface-muted"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`truncate text-sm font-medium ${
                          isActive ? "text-accent" : "text-ink"
                        }`}
                      >
                        {item.title}
                      </p>
                      <span className="shrink-0 text-[11px] text-ink-faint">
                        {formatDate(item.updatedAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                      {item.preview || "No preview"}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}
