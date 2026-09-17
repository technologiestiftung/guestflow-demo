"use client";

/**
 * Signalton für Hinweise im Team-Bereich.
 *
 * Erzeugt über die Web Audio API statt als Audiodatei: kein Asset, kein
 * Ladevorgang, funktioniert auch in einem Veranstaltungs-WLAN ohne Internet.
 *
 * Zwei Dinge, die hier leicht schiefgehen und den Ton stumm lassen:
 *
 * 1. Browser starten einen AudioContext im Zustand "suspended", solange die
 *    Person nicht mit der Seite interagiert hat. Wer den Team-Bereich nur
 *    öffnet und liegen lässt, bekäme sonst nie einen Ton. Deshalb wird beim
 *    ersten Klick oder Tastendruck irgendwo auf der Seite freigeschaltet.
 *
 * 2. Ein eigener AudioContext je Meldung läuft gegen die Obergrenze der
 *    Browser (in Chrome rund sechs gleichzeitig). Es gibt deshalb genau einen,
 *    der über die gesamte Veranstaltung bestehen bleibt.
 */

type Listener = () => void;

let context: AudioContext | null = null;
let ready = false;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

/** React kann den Freigabezustand über useSyncExternalStore mitlesen. */
export function subscribeAudioState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isAudioReady(): boolean {
  return ready;
}

export function audioSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext,
  );
}

function getContext(): AudioContext | null {
  if (context) return context;
  if (typeof window === "undefined") return null;

  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;

  try {
    context = new AudioCtor();
    return context;
  } catch {
    return null;
  }
}

function syncReady(ctx: AudioContext) {
  const next = ctx.state === "running";
  if (next !== ready) {
    ready = next;
    notify();
  }
}

/**
 * Schaltet den Ton frei. Muss aus einer echten Nutzerinteraktion heraus
 * aufgerufen werden, sonst bleibt der Kontext angehalten.
 */
export async function unlockAudio(): Promise<boolean> {
  const ctx = getContext();
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* Bleibt angehalten — die Anzeige weist dann darauf hin. */
    }
  }

  syncReady(ctx);
  return ready;
}

/**
 * Hängt sich einmalig an die erste Interaktion auf der Seite. Damit ist der Ton
 * in der Praxis freigeschaltet, sobald jemand irgendwo klickt oder tippt —
 * ohne dass dafür ein eigener Knopf gedrückt werden müsste.
 */
export function installAudioUnlock(): () => void {
  if (typeof window === "undefined") return () => {};

  const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];

  const handler = () => {
    void unlockAudio().then((ok) => {
      if (ok) remove();
    });
  };

  const remove = () => {
    for (const event of events) window.removeEventListener(event, handler);
  };

  for (const event of events) window.addEventListener(event, handler, { passive: true });
  return remove;
}

/** Ein Ton der Folge. */
function tone(ctx: AudioContext, frequency: number, startAt: number, duration: number, peak: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  // Dreieck statt Sinus: trägt in einem vollen Foyer deutlich besser.
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.05);
}

/**
 * Aufsteigender Dreiklang, einmal wiederholt. Bewusst anders als ein
 * Nachrichtenton, damit er im Betrieb nicht mit einem Telefon verwechselt wird.
 */
export async function playAlertChime(volume = 0.28): Promise<boolean> {
  const ctx = getContext();
  if (!ctx) return false;

  // Kann angehalten worden sein, etwa nachdem der Tab im Hintergrund lag.
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      syncReady(ctx);
      return false;
    }
  }
  syncReady(ctx);
  if (!ready) return false;

  const start = ctx.currentTime + 0.02;
  const notes = [587.33, 783.99, 1046.5]; // D5 – G5 – C6

  try {
    notes.forEach((frequency, index) => {
      tone(ctx, frequency, start + index * 0.13, 0.3, volume);
      // Wiederholung nach kurzer Pause — ein einzelner Ton geht im Gespräch unter.
      tone(ctx, frequency, start + 0.62 + index * 0.13, 0.3, volume);
    });
    return true;
  } catch {
    return false;
  }
}
