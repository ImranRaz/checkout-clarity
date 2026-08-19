import { Link, Outlet, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { BrandLockup } from "@/components/BrandMark";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: ConsoleLayout,
});

function ConsoleLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    await router.navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link to="/app" className="flex items-center gap-2.5">
            <BrandLockup />
            <span className="label-caps hidden sm:inline">console</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden truncate font-mono text-[11px] text-muted-foreground sm:inline">
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-mono text-[11px] transition-colors hover:bg-muted"
            >
              <LogOut className="size-3" aria-hidden />
              sign out
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
