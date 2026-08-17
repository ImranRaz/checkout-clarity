import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Link2, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createShareLink, listShareLinks, revokeShareLink } from "@/lib/share.functions";
import type { ShareLink } from "@/lib/share.functions";

/**
 * Outreach control: mints an unguessable read-only URL for one saved run so it
 * can be sent to a prospect. Live (unsaved) runs have nothing to point at, so
 * the bar only appears once a run exists in the database.
 */
export function ShareBar({ runId }: { runId: string }) {
  const load = useServerFn(listShareLinks);
  const create = useServerFn(createShareLink);
  const revoke = useServerFn(revokeShareLink);

  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let active = true;
    void (async () => {
      const rows = await loadRef.current({ data: { runId } });
      if (active) setLinks(rows);
    })();
    return () => {
      active = false;
    };
  }, [runId]);

  const active = (links ?? []).filter((l) => !l.revoked);

  async function mint() {
    setBusy(true);
    const result = await create({ data: { runId } });
    setBusy(false);
    if (!result.ok || !result.link) {
      toast.error(result.error ?? "Could not create the link.");
      return;
    }
    setLinks((prev) => [result.link!, ...(prev ?? [])]);
    await copy(result.link.token);
  }

  async function copy(token: string) {
    const url = `${window.location.origin}/r/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      toast.success("Share link copied to your clipboard.");
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 2000);
    } catch {
      toast.error(url);
    }
  }

  async function kill(token: string) {
    const result = await revoke({ data: { token } });
    if (!result.ok) {
      toast.error(result.error ?? "Could not revoke the link.");
      return;
    }
    setLinks((prev) => (prev ?? []).map((l) => (l.token === token ? { ...l, revoked: true } : l)));
    toast.success("Link revoked. It no longer opens.");
  }

  return (
    <div className="tile p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-caps flex items-center gap-2">
            <Link2 className="size-3.5" aria-hidden />
            Share this report
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            A read-only page for the prospect — no console, no rerun, revocable any time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void mint()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          Create share link
        </button>
      </div>

      {active.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {active.map((link) => (
            <li
              key={link.token}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                /r/{link.token}
              </code>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {link.viewCount} view{link.viewCount === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => void copy(link.token)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-mono text-[11px] transition-colors hover:bg-muted"
              >
                {copied === link.token ? (
                  <Check className="size-3" aria-hidden />
                ) : (
                  <Copy className="size-3" aria-hidden />
                )}
                copy
              </button>
              <button
                type="button"
                onClick={() => void kill(link.token)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" aria-hidden />
                revoke
              </button>
            </li>
          ))}
        </ul>
      ) : links ? (
        <p className="mt-4 font-mono text-[11px] text-muted-foreground">
          No active links for this run yet.
        </p>
      ) : null}
    </div>
  );
}
