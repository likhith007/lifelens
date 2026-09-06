import { useState, useEffect, useCallback } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { AppSidebar } from "@/components/AppSidebar";
import { JournalEditor } from "@/components/JournalEditor";
import { useAuth } from "@/contexts/AuthContext";
import { listArchives, type Interaction } from "@/lib/firestore";
import { JOURNAL_MODES, JOURNAL_TITLE, type JournalMode } from "@/lib/nav-features";
import { Logo } from "@/components/ui/Logo";

function DashboardContent() {
  const { user, signOut } = useAuth();
  const [archives, setArchives] = useState<Interaction[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<Interaction | null>(null);
  const [activeMode, setActiveMode] = useState<JournalMode>("reflection");
  const [draftSessionKey, setDraftSessionKey] = useState(0);
  const [loadingArchives, setLoadingArchives] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const refreshArchives = useCallback(async () => {
    if (!user) return;
    setLoadingArchives(true);
    try {
      setArchives(await listArchives(user.uid));
    } catch (err) {
      console.error("Failed to load archives:", err);
    } finally {
      setLoadingArchives(false);
    }
  }, [user]);

  useEffect(() => {
    refreshArchives();
  }, [refreshArchives]);

  const handleNewConversation = () => {
    setSelectedArchive(null);
    setActiveMode("reflection");
    setDraftSessionKey((k) => k + 1);
    setSidebarOpen(false);
  };

  const handleModeSelect = (mode: JournalMode) => {
    setSelectedArchive(null);
    setActiveMode(mode);
    setSidebarOpen(false);
  };

  const handleArchiveSelect = (interaction: Interaction) => {
    setSelectedArchive(interaction);
    setSidebarOpen(false);
  };

  const activeModeMeta = JOURNAL_MODES.find((m) => m.id === activeMode)!;
  const isDraftActive = selectedArchive === null;
  const editorKey = selectedArchive?.id ?? `draft-${draftSessionKey}`;

  return (
    <div className="flex h-screen flex-col bg-surface">
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-line bg-surface-elevated/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="btn-ghost !p-2 lg:hidden"
            aria-label="Open sidebar"
          >
            <MenuIcon />
          </button>
          <Logo size="sm" />
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden items-center gap-3 sm:flex">
            {user?.photoURL && (
              <img
                src={user.photoURL}
                alt=""
                className="h-7 w-7 rounded-full ring-1 ring-line"
                referrerPolicy="no-referrer"
              />
            )}
            <span className="max-w-[140px] truncate text-sm text-ink-secondary">
              {user?.displayName ?? "User"}
            </span>
          </div>
          <button type="button" onClick={() => signOut()} className="btn-ghost text-xs sm:text-sm">
            Sign out
          </button>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <button
            type="button"
            className="absolute inset-0 z-30 bg-ink/10 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}

        <div
          className={`absolute inset-y-0 left-0 z-40 w-72 transition-transform duration-300 ease-out lg:relative lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <AppSidebar
            activeMode={activeMode}
            onModeSelect={handleModeSelect}
            archives={archives}
            selectedArchiveId={selectedArchive?.id ?? null}
            onArchiveSelect={handleArchiveSelect}
            onNewConversation={handleNewConversation}
            loadingArchives={loadingArchives}
            isDraftActive={isDraftActive}
            onClose={() => setSidebarOpen(false)}
          />
        </div>

        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-line/60 px-6 py-5 sm:px-10">
            <p className="text-[11px] font-medium tracking-[0.15em] text-ink-faint uppercase">
              {selectedArchive ? "Archive" : JOURNAL_TITLE}
            </p>
            <h2 className="mt-1 font-serif text-2xl tracking-tight text-ink sm:text-3xl">
              {selectedArchive ? selectedArchive.title : activeModeMeta.label}
            </h2>
            {!selectedArchive && (
              <p className="mt-1 text-sm text-ink-muted">{activeModeMeta.description}</p>
            )}
            {selectedArchive?.archivedAt && (
              <p className="mt-1 text-sm text-ink-muted">
                Saved{" "}
                {selectedArchive.archivedAt.toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>

          <div className="flex flex-1 flex-col overflow-hidden px-4 py-4 sm:px-8 sm:py-6">
            <JournalEditor
              key={editorKey}
              interaction={selectedArchive}
              journalMode={activeMode}
              onInteractionCreated={() => {
                refreshArchives();
              }}
              onArchived={refreshArchives}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
