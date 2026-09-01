// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// These values are intentionally public: the browser receives them in every
// authenticated deployment. Keeping a fallback here makes production builds
// independent of an uncommitted .env file; database access remains protected
// by row-level security and server-only credentials are never exposed.
const publicBackendUrl =
  process.env["SUPABASE_URL"] ?? "https://wluxljgoovrprmoyaldg.supabase.co";
const publicBackendKey =
  process.env["SUPABASE_PUBLISHABLE_KEY"] ??
  "sb_publishable_btbYz1g4u9_QGOP_Qgp7Fg_taOAvYVT";

export default defineConfig({
  vite: {
    // Lovable Cloud supplies these as server-side build variables. Explicitly
    // expose only the public URL/key names consumed by the generated browser
    // client so production auth does not depend on a committed .env file.
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(publicBackendUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicBackendKey),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
