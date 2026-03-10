"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { isValidCredentials, setAuthCookie } from "@/lib/auth";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!isValidCredentials(username, password)) {
      setError("Credenciales incorrectas.");
      setIsSubmitting(false);
      return;
    }

    setAuthCookie();
    router.replace("/");
    router.refresh();
  }

  return (
    <form autoComplete="off" className="space-y-4" onSubmit={handleSubmit}>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-800">Usuario</span>
        <input
          autoComplete="off"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
          name="tour_usuario"
          onChange={(event) => setUsername(event.target.value)}
          required
          value={username}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-800">Clave</span>
        <input
          autoComplete="new-password"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
          name="tour_clave"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <button
        className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
