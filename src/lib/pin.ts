/**
 * Hilfsfunktionen rund um die sechsstellige PIN.
 *
 * Bewusst ohne Node-Abhängigkeiten: Diese Datei wird auch von Client-
 * Komponenten benutzt. Das Erzeugen neuer PINs braucht einen kryptografischen
 * Zufallsgenerator und steht deshalb in `pin-generator.ts`, das nur
 * serverseitig importiert werden darf.
 */

export const PIN_LENGTH = 6;

export const PIN_PATTERN = /^[0-9]{6}$/;

export function isValidPin(value: string): boolean {
  return PIN_PATTERN.test(value);
}

/**
 * Vereinheitlicht eine Eingabe: Leerzeichen und Bindestriche raus, damit
 * "482 913" und "482-913" genauso funktionieren wie "482913".
 */
export function normalizePin(value: string): string {
  return value.replace(/[\s-]/g, "");
}

/** Nimmt einen Wert aus der CSV an, wenn er nach einer PIN aussieht. */
export function parseImportedPin(value: string | null): string | null {
  if (!value) return null;
  const normalized = normalizePin(value.trim());
  return isValidPin(normalized) ? normalized : null;
}

/** Anzeigeform mit Trennung in zwei Blöcke: 482 913 statt 482913. */
export function formatPin(pin: string | null): string {
  if (!pin || pin.length !== PIN_LENGTH) return pin ?? "—";
  return `${pin.slice(0, 3)} ${pin.slice(3)}`;
}
