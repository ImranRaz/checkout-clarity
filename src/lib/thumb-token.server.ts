/**
 * Screenshots live inside private run rows, so the thumbnail endpoint can't be
 * open. Each thumbnail URL carries a short signature derived from the run id
 * and a server-only secret — handed out only to signed-in callers.
 */

function secret(): string {
  return process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_URL"] ?? "fallback";
}

export async function signThumbToken(id: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`thumb:${id}`));
  return Array.from(new Uint8Array(sig).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function verifyThumbToken(id: string, token: string): Promise<boolean> {
  const expected = await signThumbToken(id);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
