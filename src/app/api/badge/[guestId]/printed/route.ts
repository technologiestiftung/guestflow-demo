import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { guests } from "@/db/schema";
import { json } from "@/lib/api";

/**
 * Vermerkt, dass ein Namensschild gedruckt wurde. Bewusst ohne Anmeldung:
 * Der Kiosk ruft das unmittelbar nach dem Check-in auf. Es werden keine Daten
 * ausgeliefert, nur ein Zeitstempel gesetzt.
 */
export async function POST(_request: Request, ctx: { params: Promise<{ guestId: string }> }) {
  const { guestId } = await ctx.params;
  await db
    .update(guests)
    .set({ badgePrintedAt: sql`now()` })
    .where(eq(guests.id, guestId));
  return json({ ok: true });
}
