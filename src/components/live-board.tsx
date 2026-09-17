"use client";

import { useEffect, useState } from "react";
import { Badge, Dot, SectionHead, Stat } from "@/components/ui";
import {
  AlertToasts,
  NotificationSettings,
  useSupportNotifications,
} from "@/components/notifications";
import { cn, relativeTime } from "@/lib/utils";

type Live = {
  stats: { total: number; present: number; support: number; supportOpen: number; reEntries: number };
  capacity: number | null;
  recent: {
    id: string;
    name: string;
    organization: string | null;
    lastSeenAt: string | null;
    entryCount: number;
    hasSupportNeeds: boolean;
  }[];
  alerts: {
    id: string;
    name: string;
    organization: string | null;
    supportNeeds: string | null;
    checkedInAt: string | null;
  }[];
};

const POLL_MS = 5000;

export function LiveBoard({ eventId, initial }: { eventId: string; initial: Live }) {
  const [live, setLive] = useState<Live>(initial);
  const [online, setOnline] = useState(true);
  const notifications = useSupportNotifications(live.alerts);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/events/${eventId}/live`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = (await response.json()) as Live;
        if (!cancelled) {
          setLive(data);
          setOnline(true);
        }
      } catch {
        if (!cancelled) setOnline(false);
      }
    }

    const timer = setInterval(poll, POLL_MS);
    // Im Hintergrund nicht pollen — spart Akku auf dem Empfangs-Tablet.
    function onVisibility() {
      if (document.visibilityState === "visible") poll();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [eventId]);

  const { stats, capacity } = live;
  const open = stats.total - stats.present;
  const quota = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  return (
    <div className="space-y-10">
      <AlertToasts toasts={notifications.toasts} onDismiss={notifications.dismiss} />

      {/* Kennzahlen teilen sich ein Raster; getrennt wird durch Linien, nicht durch Kästen. */}
      <div className="border-y border-[var(--line)]">
        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] sm:divide-y-0 lg:grid-cols-4">
          <Stat label="Anwesend" value={stats.present} hint={`${quota} % der Angemeldeten`} delay={0} />
          <Stat label="Ausstehend" value={open} hint="angemeldet, nicht da" tone="neutral" delay={60} />
          <Stat label="Wiedereintritte" value={stats.reEntries} hint="zurückgekommen" tone="neutral" delay={120} />
          <Stat
            label="Unterstützung"
            value={stats.support}
            hint={stats.supportOpen > 0 ? `${stats.supportOpen} offen` : "alle betreut"}
            tone={stats.supportOpen > 0 ? "signal" : "neutral"}
            delay={180}
          />
        </div>
      </div>

      {capacity ? <CapacityBar present={stats.present} capacity={capacity} /> : null}

      <SupportSection
        eventId={eventId}
        alerts={live.alerts}
        settings={
          <NotificationSettings
            permission={notifications.permission}
            onRequest={notifications.requestPermission}
            soundOn={notifications.soundOn}
            onToggleSound={notifications.setSoundOn}
            audioReady={notifications.audioReady}
            onTestSound={notifications.testSound}
          />
        }
      />

      <section>
        <SectionHead
          action={
            <span
              className={cn(
                "flex items-center gap-2 text-[0.6875rem] tracking-[0.1em] uppercase",
                online ? "text-[var(--text-faint)]" : "text-[var(--color-signal)]",
              )}
            >
              <Dot tone={online ? "accent" : "signal"} pulse={online} />
              {online ? "live" : "offline"}
            </span>
          }
        >
          Zuletzt eingetroffen
        </SectionHead>

        {live.recent.length === 0 ? (
          <p className="py-10 text-sm text-[var(--text-faint)]">
            Noch niemand eingecheckt. Sobald der erste Gast anmeldet, erscheint er hier.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {live.recent.map((guest, i) => (
              <li
                key={`${guest.id}-${guest.lastSeenAt}`}
                style={{ "--d": `${i * 35}ms` } as React.CSSProperties}
                className="animate-rise stagger flex items-center gap-4 py-3"
              >
                <span className="num w-14 shrink-0 text-xs text-[var(--text-faint)]">
                  {relativeTime(guest.lastSeenAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{guest.name}</span>
                  {guest.organization ? (
                    <span className="block truncate text-xs text-[var(--text-faint)]">
                      {guest.organization}
                    </span>
                  ) : null}
                </span>
                {guest.hasSupportNeeds ? <Badge tone="signal">Assistenz</Badge> : null}
                {guest.entryCount > 1 ? (
                  <span className="num text-xs text-[var(--text-faint)]">{guest.entryCount}×</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CapacityBar({ present, capacity }: { present: number; capacity: number }) {
  const percent = Math.min(100, Math.round((present / capacity) * 100));
  const tight = percent >= 90;

  return (
    <section className="animate-rise">
      <SectionHead
        action={
          <span className="num text-[0.8125rem] text-[var(--text-faint)]">
            {present} / {capacity} Plätze
          </span>
        }
      >
        Auslastung
      </SectionHead>

      {/* Ein einziger Balken, randscharf, ohne Verlauf. */}
      <div className="mt-4 h-2 border border-[var(--line-strong)]">
        <div
          className={cn(
            "h-full transition-[width] duration-500 ease-out",
            tight ? "bg-[var(--color-signal)]" : "bg-[var(--text)]",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      {tight ? (
        <p className="mt-3 text-sm text-[var(--color-signal)]">
          Die Kapazität ist fast erreicht — Einlass beobachten.
        </p>
      ) : null}
    </section>
  );
}

function SupportSection({
  eventId,
  alerts,
  settings,
}: {
  eventId: string;
  alerts: Live["alerts"];
  settings: React.ReactNode;
}) {
  const [handled, setHandled] = useState<Set<string>>(new Set());

  async function acknowledge(guestId: string) {
    setHandled((prev) => new Set(prev).add(guestId));
    await fetch(`/api/events/${eventId}/guests/${guestId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ack_support" }),
    }).catch(() => null);
  }

  const open = alerts.filter((alert) => !handled.has(alert.id));

  // Der Abschnitt bleibt sichtbar, auch wenn nichts offen ist: nur so kann das
  // Team Ton und Systemhinweise vorab freigeben.
  return (
    <section>
      <SectionHead action={settings}>Unterstützungsbedarf</SectionHead>

      {open.length === 0 ? (
        <p className="py-6 text-sm text-[var(--text-faint)]">
          Nichts offen. Checkt jemand mit angemeldetem Unterstützungsbedarf ein, erscheint hier ein
          Hinweis — zusätzlich mit Ton und Systemmeldung.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--line)] border-l-2 border-[var(--color-signal)]">
          {open.map((alert, i) => (
            <li
              key={alert.id}
              style={{ "--d": `${i * 50}ms` } as React.CSSProperties}
              className="animate-rise stagger flex flex-wrap items-start justify-between gap-4 py-4 pl-4"
            >
              <div className="min-w-0">
                <p className="font-medium">{alert.name}</p>
                {alert.organization ? (
                  <p className="text-xs text-[var(--text-faint)]">{alert.organization}</p>
                ) : null}
                <p className="mt-2 text-sm text-[var(--color-signal)]">{alert.supportNeeds}</p>
                <p className="mt-1 text-xs text-[var(--text-faint)]">
                  eingetroffen {relativeTime(alert.checkedInAt)}
                </p>
              </div>

              <button
                onClick={() => acknowledge(alert.id)}
                className="shrink-0 border border-[var(--line-strong)] px-3 py-1.5 text-[0.8125rem] transition-colors hover:border-[var(--text)]"
              >
                Übernommen
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
