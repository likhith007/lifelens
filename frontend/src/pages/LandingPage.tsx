import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { formatAuthError } from "@/lib/auth-errors";
import { Logo } from "@/components/ui/Logo";
import { Spinner } from "@/components/ui/Spinner";

const features = [
  {
    title: "Journal through AI",
    desc: "Reflect on your day or brainstorm ideas — two modes, one private journaling space.",
  },
  {
    title: "Save to archives",
    desc: "When you're ready, say “save this to my journal” and the full chat is stored with a date.",
  },
  {
    title: "Private by design",
    desc: "Your entries stay isolated to your account with secure Firestore rules.",
  },
];

export default function LandingPage() {
  const { user, loading, configured, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Spinner label="Loading" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-surface">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-accent/10 blur-[100px]" />
        <div className="absolute -right-1/4 bottom-0 h-[400px] w-[400px] rounded-full bg-accent-light blur-[80px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12 sm:px-10">
        <header className="animate-fade-in flex items-center justify-between">
          <Logo size="md" />
          <span className="hidden text-xs tracking-widest text-ink-faint uppercase sm:block">
            AI Journaling
          </span>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-16 sm:py-24">
          <div className="animate-slide-up max-w-2xl text-center">
            <p className="mb-6 text-xs font-medium tracking-[0.2em] text-ink-faint uppercase">
              Your private reflection space
            </p>
            <h1 className="font-serif text-5xl leading-[1.1] tracking-tight text-ink sm:text-7xl">
              Think clearly.
              <br />
              <span className="italic text-ink-secondary">Save when ready.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-ink-muted">
              LifeLens is your journal through AI — reflect on your day or gently brainstorm
              your thoughts. Archive the full conversation whenever you choose.
            </p>
          </div>

          <div className="animate-slide-up mt-12 flex flex-col items-center gap-5 [animation-delay:100ms]">
            {!configured && (
              <div
                role="alert"
                className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-left text-sm text-amber-900"
              >
                <p className="font-medium">Setup required</p>
                <p className="mt-1.5 text-amber-800/80">
                  Add Firebase config to{" "}
                  <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">
                    frontend/.env
                  </code>{" "}
                  and restart the dev server.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleSignIn}
              disabled={signingIn || !configured}
              className="btn-primary flex items-center gap-3 !rounded-full !px-8 !py-3.5 shadow-soft disabled:opacity-40"
            >
              <GoogleIcon />
              {signingIn ? "Signing in…" : "Continue with Google"}
            </button>

            {error && (
              <p role="alert" className="text-sm text-red-600">{error}</p>
            )}

            <p className="text-xs text-ink-faint">
              Federated sign-in — no passwords stored
            </p>
          </div>
        </div>

        <div className="animate-fade-in grid gap-4 pb-8 sm:grid-cols-3 [animation-delay:200ms]">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-line bg-surface-elevated px-6 py-5 shadow-soft"
            >
              <h3 className="text-sm font-medium text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
