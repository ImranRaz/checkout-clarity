import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Anonymous visitors must still be able to call public server functions. If the
// auth client can't initialise (e.g. missing browser env), fall through without
// a bearer token instead of failing every RPC on the page.
const safeAttachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  try {
    return await attachSupabaseAuth.options.client!({ next } as never);
  } catch (error) {
    console.warn("[auth] could not attach session token", error);
    return next();
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [safeAttachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
