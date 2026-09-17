import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KioskClient } from "@/components/kiosk-client";
import { getEventBySlug } from "@/lib/checkin";
import { lookupLabels } from "@/lib/guest-lookup";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug).catch(() => undefined);
  return { title: event ? `Check-in — ${event.name}` : "Check-in" };
}

export default async function KioskPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event || event.archivedAt) notFound();

  return (
    <div className="min-h-dvh select-none">
      <KioskClient
        slug={event.slug}
        eventName={event.name}
        manualSearch={event.manualSearch}
        badgePrinting={event.badgePrinting}
        searchLabels={lookupLabels(event)}
      />
    </div>
  );
}
