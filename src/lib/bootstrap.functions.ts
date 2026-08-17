import { createServerFn } from "@tanstack/react-start";

/**
 * One-time owner bootstrap. Sign-ups are closed, so the very first account has
 * to be created somewhere: this refuses outright once any user exists, which
 * means it can only ever mint the owner account on an empty project.
 */

export const needsFirstAccount = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (error) return false;
      return (data?.users?.length ?? 0) === 0;
    } catch {
      return false;
    }
  },
);

export const createFirstAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const email = data.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email." };
    if (data.password.length < 10)
      return { ok: false, error: "Use at least 10 characters for the password." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    if (listError) return { ok: false, error: listError.message };
    if ((existing?.users?.length ?? 0) > 0)
      return { ok: false, error: "An account already exists. Sign in instead." };

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
