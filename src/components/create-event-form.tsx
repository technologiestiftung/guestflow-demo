"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, Label, Spinner } from "@/components/ui";

/** Vorbelegung: heute 18:00 Uhr — der häufigste Fall bei Abendveranstaltungen. */
function defaultStart(): string {
  const date = new Date();
  date.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CreateEventForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [capacity, setCapacity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, location, startsAt, capacity: capacity || null }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Anlegen fehlgeschlagen.");
        return;
      }
      router.push(`/admin/events/${data.event.id}`);
      router.refresh();
    } catch {
      setError("Keine Verbindung zum Server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Jahresempfang"
          required
          maxLength={160}
        />
      </div>

      <div>
        <Label htmlFor="startsAt">Beginn</Label>
        <Input
          id="startsAt"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          required
          className="[color-scheme:light_dark]"
        />
      </div>

      <div>
        <Label htmlFor="location">Ort (optional)</Label>
        <Input
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="z. B. Hauptgebäude, Saal 1"
          maxLength={160}
        />
      </div>

      <div>
        <Label htmlFor="capacity">Platzkapazität (optional)</Label>
        <Input
          id="capacity"
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="z. B. 120"
        />
      </div>

      {error ? (
        <p className="animate-fade border-l-2 border-[var(--color-alert)] pl-3 text-sm text-[var(--color-alert)]">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={busy || !name}>
        {busy ? <Spinner className="border-[var(--page)] border-t-transparent" /> : "Veranstaltung anlegen"}
      </Button>
    </form>
  );
}
