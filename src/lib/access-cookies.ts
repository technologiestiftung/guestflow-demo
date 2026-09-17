/**
 * Namen und Laufzeit der Gäste-Cookies.
 *
 * Bewusst ohne Abhängigkeiten: Diese Datei wird sowohl von der Middleware
 * (Edge-Runtime, kein `next/headers`) als auch vom Server-Code benutzt.
 *
 * Die Namen hängen am Slug, weil die Middleware nur den Pfad kennt und keine
 * Datenbankabfrage machen kann.
 */
export function eventKeyCookie(slug: string): string {
  return `gf_key_${slug}`;
}

export function passCookie(slug: string): string {
  return `gf_pass_${slug}`;
}

/** Ein Veranstaltungstag. */
export const ACCESS_MAX_AGE = 60 * 60 * 24;

export function accessCookieOptions(maxAge = ACCESS_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
