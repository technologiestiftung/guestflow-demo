import { headers } from "next/headers";
import QRCode from "qrcode";

/**
 * Basis-URL der Instanz. APP_URL hat Vorrang; sonst aus den Headern des
 * Requests, damit der QR-Code auch hinter einem Reverse Proxy stimmt.
 */
export async function baseUrl(): Promise<string> {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

/**
 * QR-Code als Inline-SVG. Serverseitig erzeugt — kein zusätzliches JavaScript
 * im Browser und im Druck immer gestochen scharf.
 */
export async function qrSvg(
  value: string,
  options: { margin?: number; dark?: string; light?: string } = {},
): Promise<string> {
  return QRCode.toString(value, {
    type: "svg",
    // Mittlere Fehlerkorrektur: verkraftet Knicke und Fingerabdrücke am Aushang.
    errorCorrectionLevel: "M",
    margin: options.margin ?? 1,
    color: {
      dark: options.dark ?? "#0b1020",
      light: options.light ?? "#ffffff",
    },
  });
}
