import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { accessCookieOptions, eventKeyCookie } from "@/lib/access-cookies";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/e/")) return handleSelfService(request);
  if (pathname.startsWith("/admin")) return handleAdmin(request);
  return NextResponse.next();
}

/**
 * Schützt den Team-Bereich. Kiosk, Namensschild und die Gästeseite bleiben
 * offen — sie laufen auf Geräten, an denen sich niemand anmelden soll.
 */
async function handleAdmin(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();

  const loginUrl = new URL("/admin/login", request.url);
  if (pathname !== "/admin") loginUrl.searchParams.set("weiter", pathname + search);
  return NextResponse.redirect(loginUrl);
}

/**
 * Nimmt den Zugangsschlüssel aus dem QR-Code bzw. der NFC-Plakette entgegen,
 * legt ihn ins Cookie und leitet auf die saubere Adresse um. Ob der Schlüssel
 * gültig ist, prüft erst die Seite gegen die Datenbank — hier wird er nur
 * transportiert.
 */
function handleSelfService(request: NextRequest) {
  const url = request.nextUrl;
  const key = url.searchParams.get("k");
  if (!key) return NextResponse.next();

  // Slug aus /e/<slug>
  const slug = url.pathname.split("/")[2];
  if (!slug) return NextResponse.next();

  const target = url.clone();
  target.searchParams.delete("k");

  const response = NextResponse.redirect(target);
  response.cookies.set(eventKeyCookie(slug), key, accessCookieOptions());
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/e/:path*"],
};
