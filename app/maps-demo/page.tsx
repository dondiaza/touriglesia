"use client";

import MapsShowcase from "@/src/components/maps/MapsShowcase";

export default function MapsDemoPage() {
  return (
    <main className="px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            TourIglesia
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Maps Demo</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Comparativa de motores de mapas instalados y listos para usar en el proyecto.
          </p>
        </header>

        <MapsShowcase />
      </div>
    </main>
  );
}
