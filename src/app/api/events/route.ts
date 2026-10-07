import { db } from "@/db";
import { events } from "@/db/schema";
import { fail, json, requireAdmin } from "@/lib/api";
import { slugify } from "@/lib/utils";
import { createEventSchema, readJson } from "@/lib/validation";
import { createPublicToken } from "@/lib/tokens";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = await readJson(request, createEventSchema);
  if (!parsed.isValid) return fail(parsed.error);

  const { name, location, startsAt, capacity } = parsed.data;

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
      capacity: capacity ?? null,
      publicToken: createPublicToken(),
    })
    .returning();

  return json({ event: created }, { status: 201 });
}
