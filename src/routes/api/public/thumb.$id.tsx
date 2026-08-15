import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Serves the first capture of a saved run as a real image response.
 *
 * Screenshots are stored inside the report JSON as base64 data URLs, several
 * hundred kilobytes each. Sending them through the landing-page loader would
 * add megabytes to the HTML; serving them here lets the browser lazy-load and
 * cache each thumbnail like any other image. Read-only, id-scoped, no PII.
 */

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export const Route = createFileRoute("/api/public/thumb/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.id;
        if (!ID.test(id)) return new Response("Bad id", { status: 400 });

        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
                headers.delete("Authorization");
              }
              headers.set("apikey", key);
              return fetch(input, { ...init, headers });
            },
          },
        });

        const { data, error } = await supabase
          .from("audit_runs")
          .select("report")
          .eq("id", id)
          .maybeSingle();

        if (error || !data) return new Response("Not found", { status: 404 });

        const report = data.report as
          | { stages?: Array<{ screenshot?: { src?: string } }> }
          | null;
        const src = report?.stages?.[0]?.screenshot?.src;
        if (!src || !src.startsWith("data:image/")) return new Response("No capture", { status: 404 });

        const comma = src.indexOf(",");
        const meta = src.slice(5, comma);
        const type = meta.split(";")[0] || "image/jpeg";
        const binary = atob(src.slice(comma + 1));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

        return new Response(bytes, {
          headers: {
            "content-type": type,
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
