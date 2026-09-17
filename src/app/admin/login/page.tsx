import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Anmelden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>;
}) {
  const { weiter } = await searchParams;
  // Nur interne Pfade als Weiterleitungsziel zulassen.
  const next = weiter?.startsWith("/") && !weiter.startsWith("//") ? weiter : "/admin";

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <LoginForm next={next} />
    </main>
  );
}
