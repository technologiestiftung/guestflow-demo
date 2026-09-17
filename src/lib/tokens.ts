import { randomBytes } from "node:crypto";

/** Kurz genug zum Abtippen, lang genug gegen Raten. */
export function createPublicToken(): string {
  return randomBytes(9).toString("base64url"); // 12 Zeichen, ~72 Bit
}

/** Ausweis auf dem Telefon des Gastes — nie in einer URL sichtbar. */
export function createPassToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Zeitkonstanter Vergleich für Tokens aus Anfragen. */
export function tokensMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const encoder = new TextEncoder();
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
