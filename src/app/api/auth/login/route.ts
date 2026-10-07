import { cookies } from "next/headers";
import { checkPassword, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { fail, json } from "@/lib/api";
import { clientKey, LIMITS, rateLimit } from "@/lib/rate-limit";
import { loginSchema, readJson } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = await readJson(request, loginSchema);
  if (!parsed.isValid) return fail(parsed.error);
  const { password } = parsed.data;

  // Bewusst zuerst prüfen, dann erst Budget verbrauchen: Ein richtiges Passwort
  // kommt dadurch auch dann durch, wenn jemand die Begrenzung mit falschen
  // Versuchen vollgelaufen hat. Sonst könnte sich das Team am Veranstaltungstag
  // von außen aussperren lassen.
  const correct = await checkPassword(password);

  if (!correct) {
    const within = rateLimit(clientKey(request, "login"), LIMITS.loginFailures);
    return within
      ? fail("Passwort stimmt nicht.", 401)
      : fail("Zu viele Fehlversuche. Bitte später erneut versuchen.", 429);
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
  return json({ ok: true });
}
