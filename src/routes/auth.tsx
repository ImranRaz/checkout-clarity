import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Lock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { createFirstAccount, needsFirstAccount } from "@/lib/bootstrap.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Checkout Forensic" },
      {
        name: "description",
        content: "Sign in to the Checkout Forensic console to run and review store audits.",
      },
      { property: "og:title", content: "Sign in — Checkout Forensic" },
      {
        property: "og:description",
        content: "Sign in to the Checkout Forensic console to run and review store audits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Already signed in? Go straight to the console.
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) void navigate({ to: "/app" });
    })();
  }, [navigate]);

  // On a brand new project there is no owner account yet; offer to create it.
  useEffect(() => {
    void (async () => {
      try {
        setSetupMode(await needsFirstAccount());
      } catch {
        setSetupMode(false);
      }
    })();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    if (setupMode) {
      const result = await createFirstAccount({ data: { email, password } });
      if (!result.ok) {
        setError(result.error ?? "Could not create the account.");
        setBusy(false);
        return;
      }
      setSetupMode(false);
      setNotice("Account created. Signing you in…");
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(
        signInError.message.toLowerCase().includes("invalid")
          ? "That email and password don't match an account."
          : signInError.message,
      );
      setBusy(false);
      return;
    }
    void navigate({ to: "/app" });
  }


  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="label-caps inline-flex items-center gap-2">
          <Lock className="size-3.5" aria-hidden />
          Checkout Forensic
        </Link>

        <h1 className="mt-6 font-display text-2xl tracking-tight">
          {setupMode ? "Create the owner account" : "Sign in to the console"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {setupMode
            ? "No account exists yet. Set your email and password — after this, sign-ups stay closed."
            : "Access is invite-only while we're in private beta."}
        </p>


        <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="label-caps">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-md border border-input bg-card px-3.5 py-3 font-mono text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/25"
            />
          </div>

          <div>
            <label htmlFor="password" className="label-caps">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete={setupMode ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-md border border-input bg-card px-3.5 py-3 font-mono text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/25"
            />
          </div>

          {error ? (
            <p role="alert" className="text-[13px] text-sev-high">
              {error}
            </p>
          ) : null}

          {notice && !error ? (
            <p className="text-[13px] text-muted-foreground">{notice}</p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground",
              "shadow-tile transition-all duration-200 hover:-translate-y-0.5 hover:shadow-tile-hover",
              "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:translate-y-0",
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {setupMode ? "Create account & sign in" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 font-mono text-[11px] text-muted-foreground">
          {setupMode
            ? "This one-time setup disappears the moment the first account exists."
            : "Need an account? Reply to the report we sent you and we'll set one up."}
        </p>
      </div>

    </main>
  );
}
