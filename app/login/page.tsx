import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import LoginForm from "@/components/LoginForm";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE } from "@/lib/constants";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.get(AUTH_COOKIE_NAME)?.value === AUTH_COOKIE_VALUE;

  if (isLoggedIn) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-[var(--shadow)]">
        <div className="mb-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            TourIglesia
          </p>
          <h1 className="font-display text-3xl font-semibold text-slate-900">
            Acceso demo
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Esta autenticacion es solo para demostracion local y no es segura para produccion.
            Introduce tus credenciales para acceder a la aplicacion protegida.
          </p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
