import type { Interaction } from "@/lib/firestore";
import { JOURNAL_MODES, JOURNAL_TITLE, type JournalMode } from "@/lib/nav-features";

interface AppSidebarProps {
  activeMode: JournalMode;
  onModeSelect: (mode: JournalMode) => void;
  archives: Interaction[];
  selectedArchiveId: string | null;
  onArchiveSelect: (interaction: Interaction) => void;
  onNewConversation: () => void;
  loadingArchives: boolean;
  isDraftActive: boolean;
  onClose?: () => void;
}

function formatArchiveDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AppSidebar({
  activeMode,
  onModeSelect,
  archives,
  selectedArchiveId,
  onArchiveSelect,
  onNewConversation,
  loadingArchives,
  isDraftActive,
  onClose,
}: AppSidebarProps) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-surface-elevated">
      <div className="flex items-center justify-between border-b border-line px-4 py-4">
        <p className="text-[11px] font-medium tracking-[0.15em] text-ink-faint uppercase">
          LifeLens
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

      <div className="border-b border-line p-3">
        <button
          type="button"
          onClick={onNewConversation}
          className={`w-full rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
            isDraftActive
              ? "bg-accent text-white shadow-soft"
              : "border border-line text-ink-secondary hover:border-line-strong hover:bg-surface-muted hover:text-ink"
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <PlusIcon />
            New journal entry
          </span>
        </button>
      </div>

      <div className="border-b border-line px-3 py-4">
        <p className="mb-1 px-2 text-[10px] font-medium tracking-[0.12em] text-ink-faint uppercase">
          {JOURNAL_TITLE}
        </p>
        <p className="mb-3 px-2 text-[11px] leading-snug text-ink-muted">
          Choose a mode for your session.
        </p>
        <p className="mb-2 px-2 text-[10px] font-medium tracking-[0.12em] text-ink-faint uppercase">
          Modes
        </p>
        <ul className="space-y-0.5">
          {JOURNAL_MODES.map((mode) => {
            const isActive = activeMode === mode.id && isDraftActive;
            return (
              <li key={mode.id}>
                <button
                  type="button"
                  onClick={() => onModeSelect(mode.id)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
                    isActive ? "bg-accent-light" : "hover:bg-surface-muted"
                  }`}
                >
                  <p className={`text-sm font-medium ${isActive ? "text-accent" : "text-ink"}`}>
                    {mode.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">
                    {mode.description}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 py-4">
        <p className="mb-2 px-2 text-[10px] font-medium tracking-[0.12em] text-ink-faint uppercase">
          Archives
        </p>
        <div className="flex-1 overflow-y-auto">
          {loadingArchives ? (
            <div className="space-y-2 px-2 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-muted" />
              ))}
            </div>
          ) : archives.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs leading-relaxed text-ink-faint">
              No archives yet.
              <br />
              Say &ldquo;save this to my journal&rdquo; when you&apos;re ready.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {archives.map((item) => {
                const isActive = selectedArchiveId === item.id;
                const date = item.archivedAt ?? item.createdAt;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onArchiveSelect(item)}
                      className={`group w-full rounded-xl px-3 py-3 text-left transition-all duration-150 ${
                        isActive ? "bg-accent-light" : "hover:bg-surface-muted"
                      }`}
                    >
                      <p
                        className={`truncate text-sm font-medium ${
                          isActive ? "text-accent" : "text-ink"
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-faint">
                        {formatArchiveDate(date)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                        {item.preview || "Saved conversation"}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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
