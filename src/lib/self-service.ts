import { cookies } from "next/headers";
import type { Event } from "@/db/schema";
import { accessCookieOptions, eventKeyCookie, passCookie } from "./access-cookies";
import { tokensMatch } from "./tokens";

export { eventKeyCookie, passCookie } from "./access-cookies";

/**
 * Der Aushang-QR und die NFC-Plakette tragen den Zugangsschlüssel der
 * Veranstaltung. Wer ihn hat, stand vor Ort am Eingang — das ist die
 * Zugangskontrolle für die mobile Selbstanmeldung.
 *
 * Gesetzt wird das Cookie in der Middleware (Server-Komponenten dürfen keine
 * Cookies schreiben). Der Schlüssel verschwindet dabei aus der Adresszeile,
 * damit er nicht über Verlauf oder geteilte Screenshots abfließt.
 *
 * Die Cookie-Namen hängen am Slug, weil die Middleware nur den Pfad kennt und
 * keine Datenbankabfrage machen kann.
 */
export async function hasEventAccess(event: Event): Promise<boolean> {
  const store = await cookies();
  // Der Wert aus dem Cookie ist ungeprüft — erst der Vergleich mit dem
  // Datenbankwert entscheidet.
  return tokensMatch(store.get(eventKeyCookie(event.slug))?.value, event.publicToken);
}

/** Digitaler Ausweis auf dem Telefon — macht den Wiedereintritt zum einen Tipp. */
export async function readPass(event: Event): Promise<string | null> {
  const store = await cookies();
  return store.get(passCookie(event.slug))?.value ?? null;
}

export async function writePass(event: Event, passToken: string) {
  const store = await cookies();
  store.set(passCookie(event.slug), passToken, accessCookieOptions());
}

/**
 * Adresse hinter Aushang-QR und NFC-Plakette. Der Kanal steckt als Parameter
 * mit drin — so lässt sich auswerten, welcher Weg genutzt wurde, ohne dass
 * sich am Ablauf für die Gäste etwas ändert.
 */
export function selfCheckinUrl(
  baseUrl: string,
  event: Event,
  channel: "qr" | "nfc" = "qr",
): string {
  const url = new URL(`/e/${event.slug}`, baseUrl);
  url.searchParams.set("k", event.publicToken);
  if (channel === "nfc") url.searchParams.set("m", "nfc");
  return url.toString();
}
