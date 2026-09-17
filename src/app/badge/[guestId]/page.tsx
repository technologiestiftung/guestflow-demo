import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { guests } from "@/db/schema";
import { BadgePrintTrigger } from "@/components/badge-print-trigger";
import { GuestFlowWordmark } from "@/components/brand";

export const dynamic = "force-dynamic";
export const metadata = { title: "Namensschild" };

/**
 * Druckansicht im Format 90 × 54 mm (Standard-Badgeeinsatz).
 * Absichtlich hell: Namensschilder werden auf weißes Papier gedruckt.
 */
export default async function BadgePage({ params }: { params: Promise<{ guestId: string }> }) {
  const { guestId } = await params;
  const guest = await db.query.guests.findFirst({
    where: eq(guests.id, guestId),
    with: { event: true },
  });
  if (!guest) notFound();

  const fullName = [guest.firstName, guest.lastName].filter(Boolean).join(" ");
  // Lange Namen kleiner setzen, damit nichts umbricht.
  const nameSize =
    fullName.length > 26 ? "text-[17pt]" : fullName.length > 18 ? "text-[21pt]" : "text-[25pt]";

  return (
    <div className="grid min-h-dvh place-items-center bg-neutral-100 p-6 print:block print:min-h-0 print:bg-white print:p-0">
      <style>{`@page { size: 90mm 54mm; margin: 0; }`}</style>
      <BadgePrintTrigger guestId={guest.id} />

      <div className="h-[54mm] w-[90mm] overflow-hidden border border-neutral-300 bg-white text-black print:border-0">
        <div className="flex h-full flex-col justify-between p-[6mm]">
          <div className="flex items-start justify-between gap-3">
            <p className="truncate text-[7.5pt] font-medium tracking-[0.14em] text-neutral-500 uppercase">
              {guest.event.name}
            </p>
            {guest.supportNeeds ? (
              // Dezentes Quadrat: das Team erkennt den Hinweis, ohne dass er auf dem Schild steht.
              <span className="mt-[1mm] h-[2mm] w-[2mm] shrink-0 bg-black" aria-hidden />
            ) : null}
          </div>

          <div className="min-w-0">
            <p className={`${nameSize} leading-[1.05] font-medium tracking-[-0.03em]`}>
              {fullName}
            </p>
            {guest.organization ? (
              <p className="mt-[2mm] truncate text-[10.5pt] text-neutral-600">
                {guest.organization}
              </p>
            ) : null}
          </div>

          <div className="flex items-end justify-between border-t border-neutral-300 pt-[2.5mm]">
            <span className="text-[6.5pt] tracking-[0.12em] text-neutral-400 uppercase">
              Check-in
            </span>
            <GuestFlowWordmark className="text-[7pt] tracking-[0.1em] text-neutral-400 uppercase" />
          </div>
        </div>
      </div>

      <p className="no-print mt-6 text-center text-sm text-neutral-500">
        Der Druckdialog öffnet sich automatisch. Format: 90 × 54 mm.
      </p>
    </div>
  );
}
