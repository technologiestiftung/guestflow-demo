import { cookies } from "next/headers";

export const SESSION_COOKIE = "selfcheck_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // eine Veranstaltungsschicht

function secretKeyMaterial(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET fehlt oder ist zu kurz (mind. 16 Zeichen).");
  }
  return new TextEncoder().encode(secret);
}

/** base64url ohne Buffer — die Middleware läuft in der Edge-Runtime. */
function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretKeyMaterial() as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(sig);
}

/** Zeitkonstanter Vergleich — verhindert Timing-Rückschlüsse auf Passwort/Signatur. */
export function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) {
    // Trotzdem vergleichen, damit die Laufzeit nicht von der Länge abhängt.
    crypto.getRandomValues(new Uint8Array(1));
    return false;
  }
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `admin.${expires}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [role, expiresRaw, signature] = parts;
  const payload = `${role}.${expiresRaw}`;
  const expected = await hmac(payload).catch(() => null);
  if (!expected || !safeEqual(signature, expected)) return false;
  const expires = Number(expiresRaw);
  return Number.isFinite(expires) && expires > Date.now();
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function checkPassword(candidate: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD ist nicht gesetzt.");
  // Über den Hash vergleichen, damit unterschiedliche Längen nichts verraten.
  const [a, b] = await Promise.all([hmac(`pw:${candidate}`), hmac(`pw:${expected}`)]);
  return safeEqual(a, b);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};
