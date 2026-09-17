"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GuestFlowLogo } from "@/components/brand";
import { Button, Input, Label, Spinner } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Anmeldung fehlgeschlagen.");
        setPassword("");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Keine Verbindung zum Server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise w-full max-w-sm">
      <GuestFlowLogo size="md" animated />

      <h1 className="mt-12 text-2xl font-medium tracking-[-0.03em]">Team-Bereich</h1>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Veranstaltungen anlegen, Gästeliste importieren, Anwesenheit verfolgen.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 border-t border-[var(--line)] pt-8">
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />

        {error ? (
          <p className="animate-fade mt-3 border-l-2 border-[var(--color-alert)] pl-3 text-sm text-[var(--color-alert)]">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="mt-6 w-full" disabled={busy || !password}>
          {busy ? <Spinner className="border-[var(--page)] border-t-transparent" /> : "Anmelden"}
        </Button>
      </form>

      <p className="mt-8 text-xs leading-relaxed text-[var(--text-faint)]">
        Das Passwort steht in der Datei <code className="font-mono">.env</code> unter{" "}
        <code className="font-mono">ADMIN_PASSWORD</code>.
      </p>
    </div>
  );
}
