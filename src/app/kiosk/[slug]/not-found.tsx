import { GuestFlowLogo } from "@/components/brand";
import { ButtonLink } from "@/components/ui";

export default function KioskNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="animate-rise max-w-md text-center">
        <GuestFlowLogo size="lg" className="mb-10" />
        <h1 className="text-2xl font-medium tracking-[-0.03em]">Veranstaltung nicht gefunden</h1>
        <p className="mt-3 text-[var(--text-soft)] text-pretty">
          Diese Check-in-Adresse gibt es nicht oder die Veranstaltung wurde archiviert.
        </p>
        <ButtonLink href="/" size="lg" className="mt-8">
          Zur Übersicht
        </ButtonLink>
      </div>
    </main>
  );
}
