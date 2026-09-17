import { sql as raw } from "drizzle-orm";
import { db } from "@/db";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Für den Healthcheck im Container und für Monitoring. */
export async function GET() {
  try {
    await db.execute(raw`select 1`);
    return json({ status: "ok", database: "up" });
  } catch {
    return json({ status: "degraded", database: "down" }, { status: 503 });
  }
}
