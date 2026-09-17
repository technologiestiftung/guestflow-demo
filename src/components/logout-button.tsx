"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={busy}
      className="px-3 py-1.5 text-sm text-[var(--text-soft)] transition-colors hover:text-[var(--text)] disabled:opacity-40"
    >
      Abmelden
    </button>
  );
}
