"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  audioSupported,
  installAudioUnlock,
  isAudioReady,
  playAlertChime,
  subscribeAudioState,
  unlockAudio,
} from "@/lib/chime";
import { cn } from "@/lib/utils";

export type SupportAlert = {
  id: string;
  name: string;
  organization: string | null;
  supportNeeds: string | null;
  checkedInAt: string | null;
};

export type NotificationPermissionState = "unsupported" | "default" | "granted" | "denied";

/**
 * Meldet neu eingetroffene Gäste mit Unterstützungsbedarf: Ton, Systemhinweis
 * und ein Einblender auf dem Schirm. Beim ersten Laden wird bewusst nichts
 * gemeldet — sonst piept es bei jedem Seitenaufruf für alle Altfälle.
 */
export function useSupportNotifications(alerts: SupportAlert[]) {
  const [toasts, setToasts] = useState<SupportAlert[]>([]);
  const [permission, setPermission] = useState<NotificationPermissionState>("unsupported");
  const [soundOn, setSoundOn] = useState(true);

  // Freigabezustand des Tons — der Browser kann ihn jederzeit anhalten.
  const audioReady = useSyncExternalStore(
    subscribeAudioState,
    isAudioReady,
    () => false, // auf dem Server gibt es keinen Ton
  );

  // Erste Interaktion irgendwo auf der Seite schaltet den Ton frei.
  useEffect(() => installAudioUnlock(), []);

  const knownRef = useRef<Set<string> | null>(null);

  // Der Ton-Schalter steckt in einer Ref, damit ein Umschalten nicht als neue
  // Meldung durchgeht. Geschrieben wird er im Effekt, nicht beim Rendern.
  const soundOnRef = useRef(soundOn);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermission(Notification.permission as NotificationPermissionState);
  }, []);

  const requestPermission = useCallback(async () => {
    // Läuft aus einem Klick heraus — der richtige Moment, den Ton mitzunehmen.
    await unlockAudio();
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result as NotificationPermissionState);
  }, []);

  /** Vorab ausprobieren, ob im Raum wirklich etwas zu hören ist. */
  const testSound = useCallback(async () => {
    await unlockAudio();
    await playAlertChime();
  }, []);

  useEffect(() => {
    const incomingIds = alerts.map((alert) => alert.id);

    if (knownRef.current === null) {
      knownRef.current = new Set(incomingIds);
      return;
    }

    const fresh = alerts.filter((alert) => !knownRef.current!.has(alert.id));
    knownRef.current = new Set(incomingIds);
    if (fresh.length === 0) return;

    if (soundOnRef.current) void playAlertChime();

    setToasts((prev) => [...fresh, ...prev].slice(0, 4));

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      for (const alert of fresh) {
        try {
          new Notification("Unterstützung angemeldet", {
            body: `${alert.name} ist eingetroffen — ${alert.supportNeeds ?? "Assistenz benötigt"}`,
            tag: `guestflow-support-${alert.id}`,
            icon: "/icon.svg",
          });
        } catch {
          /* Systemhinweise sind optional. */
        }
      }
    }
  }, [alerts]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return {
    toasts,
    dismiss,
    permission,
    requestPermission,
    soundOn,
    setSoundOn,
    audioReady,
    audioSupported: audioSupported(),
    testSound,
  };
}

export function AlertToasts({
  toasts,
  onDismiss,
}: {
  toasts: SupportAlert[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed right-5 bottom-5 z-50 flex w-[min(23rem,calc(100vw-2.5rem))] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast, i) => (
        <div
          key={toast.id}
          style={{ "--d": `${i * 60}ms` } as React.CSSProperties}
          className="animate-rise stagger flex items-start gap-3 border border-[var(--text)] border-l-[3px] border-l-[var(--color-signal)] bg-[var(--page)] px-4 py-3.5"
        >
          <div className="min-w-0 flex-1">
            <p className="label text-[var(--color-signal)]">Unterstützung angemeldet</p>
            <p className="mt-2 truncate font-medium">{toast.name}</p>
            {toast.organization ? (
              <p className="truncate text-xs text-[var(--text-faint)]">{toast.organization}</p>
            ) : null}
            <p className="mt-1.5 text-sm text-[var(--text-soft)]">{toast.supportNeeds}</p>
          </div>

          <button
            onClick={() => onDismiss(toast.id)}
            aria-label="Hinweis schließen"
            className="-mt-1 -mr-1 shrink-0 p-1.5 text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export function NotificationSettings({
  permission,
  onRequest,
  soundOn,
  onToggleSound,
  audioReady,
  onTestSound,
}: {
  permission: NotificationPermissionState;
  onRequest: () => void;
  soundOn: boolean;
  onToggleSound: (value: boolean) => void;
  audioReady: boolean;
  onTestSound: () => void;
}) {
  const chip = "border px-2 py-1 text-[0.6875rem] tracking-[0.06em] uppercase transition-colors";
  const quiet =
    "border-[var(--line-strong)] text-[var(--text-faint)] hover:border-[var(--text)] hover:text-[var(--text)]";
  const solid = "border-[var(--text)] bg-[var(--text)] text-[var(--page)]";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={soundOn}
        onClick={() => onToggleSound(!soundOn)}
        className={cn(chip, soundOn ? solid : quiet)}
      >
        Ton {soundOn ? "an" : "aus"}
      </button>

      {/*
        Browser lassen Ton erst nach einer Interaktion zu. Solange das nicht
        passiert ist, bliebe die Meldung stumm — deshalb sichtbar machen statt
        stillschweigend hinnehmen.
      */}
      {soundOn ? (
        <button
          type="button"
          onClick={onTestSound}
          className={cn(
            chip,
            audioReady ? quiet : "border-[var(--color-signal)] text-[var(--color-signal)]",
          )}
        >
          {audioReady ? "Ton testen" : "Ton freigeben"}
        </button>
      ) : null}

      {permission === "granted" ? (
        <span className={cn(chip, "border-[var(--line-strong)] text-[var(--text-faint)]")}>
          Systemhinweise aktiv
        </span>
      ) : permission === "denied" ? (
        <span className={cn(chip, "border-[var(--line)] text-[var(--text-faint)]")}>
          Systemhinweise blockiert
        </span>
      ) : (
        <button type="button" onClick={onRequest} className={cn(chip, quiet)}>
          Systemhinweise erlauben
        </button>
      )}
    </div>
  );
}
