import { randomInt } from "node:crypto";

/**
 * Erzeugt PINs. Nur serverseitig importieren — `node:crypto` lässt sich nicht
 * in ein Browser-Bundle packen. Die reinen Hilfsfunktionen (prüfen, formatieren)
 * stehen in `pin.ts` und dürfen überall verwendet werden.
 *
 * Erzeugt wird im Bereich 100000–999999, also ohne führende Null. Das kostet
 * ein Zehntel des Raums, erspart aber die häufigste Verwechslung beim Abtippen
 * und beim Vorlesen am Empfang. PINs aus einem Doo-Export dürfen dagegen eine
 * führende Null haben — dort gibt die Quelle den Wert vor.
 */
const MIN = 100_000;
const MAX = 999_999;

const MAX_ATTEMPTS = 200;

/**
 * Erzeugt eine PIN, die sich innerhalb der Veranstaltung nicht wiederholt.
 *
 * `taken` enthält die bereits vergebenen PINs und wird mitgeführt, damit auch
 * innerhalb eines Imports keine Dublette entsteht. Bei 900.000 möglichen Werten
 * ist eine Kollision selbst bei einigen tausend Gästen selten; der Abbruch nach
 * einer festen Zahl Versuche verhindert trotzdem eine Endlosschleife, falls der
 * Raum wider Erwarten eng wird.
 */
export function createUniquePin(taken: Set<string>): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = String(randomInt(MIN, MAX + 1));
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }

  throw new Error(
    "Es konnte keine freie PIN gefunden werden. Bei dieser Gästezahl ist der " +
      "sechsstellige Bereich zu eng — bitte einen anderen Suchmodus wählen.",
  );
}
