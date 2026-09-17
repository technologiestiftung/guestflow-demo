"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Input } from "@/components/ui";
import { cn, formatTime, relativeTime } from "@/lib/utils";

export type GuestRow = {
  id: string;
  firstName: string;
  lastName: string;
  organization: string | null;
  email: string | null;
  supportNeeds: string | null;
  ticketType: string | null;
  checkedInAt: string | null;
  lastSeenAt: string | null;
  entryCount: number;
};

type Filter = "all" | "present" | "open" | "support";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "present", label: "Anwesend" },
  { key: "open", label: "Ausstehend" },
  { key: "support", label: "Assistenz" },
];

export function GuestTable({ eventId, guests }: { eventId: string; guests: GuestRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [workingId, setWorkingId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: guests.length,
      present: guests.filter((g) => g.checkedInAt).length,
      open: guests.filter((g) => !g.checkedInAt).length,
      support: guests.filter((g) => g.supportNeeds).length,
    }),
    [guests],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return guests.filter((guest) => {
      if (filter === "present" && !guest.checkedInAt) return false;
      if (filter === "open" && guest.checkedInAt) return false;
      if (filter === "support" && !guest.supportNeeds) return false;
      if (!needle) return true;
      return [guest.firstName, guest.lastName, guest.organization, guest.email]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle));
    });
  }, [guests, filter, query]);

  async function act(guestId: string, action: "checkin" | "undo") {
    setWorkingId(guestId);
    await fetch(`/api/events/${eventId}/guests/${guestId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    setWorkingId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div>
      {/* Filter als Registerreihe auf einer Linie — kein Kasten, keine Füllung. */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)]">
        <div className="-mb-px flex">
          {FILTERS.map((entry) => (
            <button
              key={entry.key}
              onClick={() => setFilter(entry.key)}
              className={cn(
                "border-b-2 px-3.5 pb-2.5 text-sm transition-colors",
                filter === entry.key
                  ? "border-[var(--text)] text-[var(--text)]"
                  : "border-transparent text-[var(--text-faint)] hover:text-[var(--text)]",
              )}
            >
              {entry.label}
              <span className="num ml-2 text-xs opacity-60">{counts[entry.key]}</span>
            </button>
          ))}
        </div>

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, Organisation, E-Mail"
          className="mb-2 h-9 w-full border-0 border-b border-[var(--line-strong)] px-0 text-sm sm:w-64"
          aria-label="Gästeliste durchsuchen"
        />
      </div>

      {visible.length === 0 ? (
        <p className="py-14 text-center text-sm text-[var(--text-faint)]">
          {guests.length === 0
            ? "Noch keine Gästeliste importiert."
            : "Keine Treffer für diese Auswahl."}
        </p>
      ) : (
        <div className="max-h-[34rem] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--page)]">
              <tr className="border-b border-[var(--line)]">
                <th className="label py-3 pr-4 font-medium">Gast</th>
                <th className="label hidden py-3 pr-4 font-medium sm:table-cell">Organisation</th>
                <th className="label py-3 pr-4 font-medium">Status</th>
                <th className="label py-3 text-right font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((guest) => {
                const present = Boolean(guest.checkedInAt);
                const busy = workingId === guest.id || pending;
                return (
                  <tr
                    key={guest.id}
                    className={cn(
                      "border-b border-[var(--line)] transition-colors hover:bg-[var(--page-sunk)]",
                      busy && "opacity-40",
                    )}
                  >
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">
                          {guest.firstName} {guest.lastName}
                        </span>
                        {guest.supportNeeds ? (
                          <span
                            title={guest.supportNeeds}
                            aria-label="Unterstützungsbedarf angemeldet"
                            className="h-1.5 w-1.5 shrink-0 bg-[var(--color-signal)]"
                          />
                        ) : null}
                      </span>
                      {guest.email ? (
                        <span className="block text-xs text-[var(--text-faint)]">{guest.email}</span>
                      ) : null}
                    </td>

                    <td className="hidden py-3 pr-4 text-[var(--text-soft)] sm:table-cell">
                      {guest.organization ?? "—"}
                    </td>

                    <td className="py-3 pr-4">
                      {present ? (
                        <>
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 bg-[var(--color-accent)]" />
                            <span className="num text-[var(--text)]">
                              seit {formatTime(guest.checkedInAt)}
                            </span>
                          </span>
                          {guest.entryCount > 1 ? (
                            <span className="num block text-xs text-[var(--text-faint)]">
                              {guest.entryCount} Eintritte · zuletzt {relativeTime(guest.lastSeenAt)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[var(--text-faint)]">ausstehend</span>
                      )}
                    </td>

                    <td className="py-3 text-right">
                      <button
                        disabled={busy}
                        onClick={() => act(guest.id, present ? "undo" : "checkin")}
                        className={cn(
                          "border px-2.5 py-1 text-xs transition-colors disabled:opacity-40",
                          present
                            ? "border-[var(--line-strong)] text-[var(--text-faint)] hover:border-[var(--text)] hover:text-[var(--text)]"
                            : "border-[var(--text)] text-[var(--text)] hover:bg-[var(--text)] hover:text-[var(--page)]",
                        )}
                      >
                        {present ? "zurücknehmen" : "einchecken"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
