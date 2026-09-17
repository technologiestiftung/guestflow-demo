import { cookies } from "next/headers";
import { checkPassword, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { fail, json } from "@/lib/api";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Fünf Versuche pro Minute und IP — bremst Rateversuche ohne echte Nutzung zu stören.
  if (!rateLimit(clientKey(request, "login"), 5, 60_000)) {
    return fail("Zu viele Versuche. Bitte kurz warten.", 429);
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return fail("Passwort fehlt.");

  if (!(await checkPassword(password))) {
    return fail("Passwort stimmt nicht.", 401);
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
  return json({ ok: true });
}
