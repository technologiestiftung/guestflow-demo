"use client";

import { useEffect } from "react";

/**
 * Öffnet den Druckdialog und vermerkt den Druck am Gast.
 * Läuft auch im versteckten Rahmen des Kiosks — dort druckt der Kiosk selbst,
 * deshalb wird window.print() nur im Top-Level-Fenster aufgerufen.
 */
export function BadgePrintTrigger({ guestId }: { guestId: string }) {
  useEffect(() => {
    const isEmbedded = window.self !== window.top;

    fetch(`/api/badge/${guestId}/printed`, { method: "POST" }).catch(() => {
      /* Der Vermerk ist Komfort, kein Muss. */
    });

    if (isEmbedded) return;
    const timer = setTimeout(() => window.print(), 350);
    return () => clearTimeout(timer);
  }, [guestId]);

  return null;
}
