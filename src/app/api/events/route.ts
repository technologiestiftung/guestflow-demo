import { db } from "@/db";
import { events } from "@/db/schema";
import { fail, json, requireAdmin } from "@/lib/api";
import { clampString, slugify } from "@/lib/utils";
import { createPublicToken } from "@/lib/tokens";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const name = clampString(body?.name, 160);
  const location = clampString(body?.location, 160);
  const startsAtRaw = clampString(body?.startsAt, 40);
  const capacityRaw = body?.capacity;

  if (!name) return fail("Name der Veranstaltung fehlt.");
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) return fail("Datum ist ungültig.");

  const capacity =
    capacityRaw === null || capacityRaw === undefined || capacityRaw === ""
      ? null
      : Number(capacityRaw);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
    return fail("Kapazität muss eine positive ganze Zahl sein.");
  }

  // Slug muss eindeutig sein — bei Kollision zählen wir hoch.
  const base = slugify(name) || "veranstaltung";
  let slug = base;
  for (let attempt = 2; attempt < 50; attempt++) {
    const taken = await db.query.events.findFirst({
      where: (e, { eq }) => eq(e.slug, slug),
      columns: { id: true },
    });
    if (!taken) break;
    slug = `${base}-${attempt}`;
  }

  const [created] = await db
    .insert(events)
    .values({
      name,
      slug,
      location: location || null,
      startsAt,
      capacity,
      publicToken: createPublicToken(),
    })
    .returning();

  return json({ event: created }, { status: 201 });
}
