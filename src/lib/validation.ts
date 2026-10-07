import { z } from "zod";

/**
 * Schemata für API-Eingaben.
 *
 * An einer Stelle gebündelt, damit Kiosk und Gästeseite dieselben Grenzen
 * verwenden und sich Felder nicht auseinanderentwickeln.
 */

/** Freitext aus einem Eingabefeld — begrenzt, damit nichts Unbegrenztes in eine Abfrage läuft. */
const searchQuery = z.string().trim().max(120);

export const lookupSchema = z.object({
  query: searchQuery,
});

export const kioskCheckinSchema = z.object({
  code: z.string().trim().max(400).optional(),
  guestId: z.uuid().optional(),
  method: z.enum(["qr", "manual"]).default("qr"),
});

export const selfCheckinSchema = z.object({
  guestId: z.uuid().optional(),
  channel: z.enum(["qr", "nfc"]).default("qr"),
});

export const loginSchema = z.object({
  password: z.string().min(1).max(200),
});

export const createEventSchema = z.object({
  name: z.string().trim().min(1).max(160),
  location: z.string().trim().max(160).optional().nullable(),
  startsAt: z.coerce.date(),
  capacity: z.coerce.number().int().positive().nullable().optional(),
});

export const updateEventSchema = z.object({
  badgePrinting: z.boolean().optional(),
  manualSearch: z.boolean().optional(),
  allowReEntry: z.boolean().optional(),
  selfServiceEnabled: z.boolean().optional(),
  lookupMode: z.enum(["name", "email", "pin"]).optional(),
  location: z.string().trim().max(160).optional(),
  archived: z.boolean().optional(),
  rotateToken: z.boolean().optional(),
});

export const guestActionSchema = z.object({
  action: z.enum(["checkin", "undo", "ack_support", "badge_printed"]),
});

type ParseOk<T> = { isValid: true; data: T };
type ParseFailed = { isValid: false; error: string };

/**
 * Liest und prüft einen JSON-Rumpf. Der Client bekommt nur eine allgemeine
 * Meldung — Feldnamen und Schema-Details bleiben auf dem Server.
 *
 * `isValid` ist das Unterscheidungsmerkmal der Union, damit TypeScript nach
 * der Prüfung weiß, dass `data` gesetzt ist.
 */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<ParseOk<z.infer<T>> | ParseFailed> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body ?? {});
  return parsed.success
    ? { isValid: true, data: parsed.data }
    : { isValid: false, error: "Die Eingabe ist unvollständig oder ungültig." };
}
