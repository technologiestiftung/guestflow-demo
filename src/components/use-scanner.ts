"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

export type ScannerStatus = "idle" | "starting" | "running" | "denied" | "unavailable" | "error";

// Doo liefert QR; Handscanner und ältere Tickets auch lineare Codes.
const FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.PDF_417,
  BarcodeFormat.AZTEC,
];

export function useScanner(onCode: (code: string) => void, enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  // Callback in einer Ref halten: der Scanner soll nicht bei jedem Render neu starten.
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    let cancelled = false;

    async function start() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        setMessage("Diese Ansicht braucht eine Kamera und HTTPS.");
        return;
      }

      setStatus("starting");
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });

      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current ?? undefined,
          (result) => {
            if (result) onCodeRef.current(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStatus("running");
        setMessage(null);
      } catch (error) {
        if (cancelled) return;
        const name = (error as DOMException)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied");
          setMessage("Kamerazugriff wurde abgelehnt. Bitte in den Browsereinstellungen erlauben.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setStatus("unavailable");
          setMessage("Keine Kamera gefunden.");
        } else {
          setStatus("error");
          setMessage("Die Kamera konnte nicht gestartet werden.");
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [enabled, stop]);

  return { videoRef, status, message, stop };
}

/**
 * Handscanner am USB-Port verhalten sich wie eine Tastatur: schnelle Zeichenfolge,
 * abgeschlossen mit Enter. Das fangen wir global ab, solange kein Feld fokussiert ist.
 */
export function useKeyboardWedge(onCode: (code: string) => void, enabled: boolean) {
  const bufferRef = useRef("");
  const lastKeyRef = useRef(0);
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!enabled) return;

    function handler(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const now = Date.now();
      // Über 120 ms Pause tippt ein Mensch — Puffer verwerfen.
      if (now - lastKeyRef.current > 120) bufferRef.current = "";
      lastKeyRef.current = now;

      if (event.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        if (code.length >= 4) onCodeRef.current(code);
        return;
      }
      if (event.key.length === 1) bufferRef.current += event.key;
      if (bufferRef.current.length > 512) bufferRef.current = "";
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}
