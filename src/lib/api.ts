import { NextResponse } from "next/server";
import { isAuthenticated } from "./auth";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wrapper für alle Endpunkte im Team-Bereich. */
export async function requireAdmin(): Promise<NextResponse | null> {
  return (await isAuthenticated()) ? null : fail("Nicht angemeldet.", 401);
}

/** E-Mail für Anzeigen im Kiosk kürzen — genug zum Wiedererkennen, nicht zum Abschreiben. */
export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  const head = local.slice(0, 1);
  return `${head}${"•".repeat(Math.max(2, Math.min(local.length - 1, 5)))}@${domain}`;
}
