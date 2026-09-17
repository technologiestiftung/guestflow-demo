import Link from "next/link";
import { GuestFlowLogo } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { isAuthenticated } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authenticated = await isAuthenticated();

  return (
    <div className="min-h-dvh">
      {authenticated ? (
        <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--page)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link href="/admin" className="transition-opacity hover:opacity-60">
              <GuestFlowLogo size="sm" />
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-1.5 text-sm text-[var(--text-soft)] transition-colors hover:text-[var(--text)]"
              >
                Übersicht
              </Link>
              <LogoutButton />
            </nav>
          </div>
        </header>
      ) : null}
      {children}
    </div>
  );
}
