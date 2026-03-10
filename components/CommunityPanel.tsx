"use client";

import type { CommunityPlace } from "@/lib/types";

type CommunityPanelProps = {
  places: CommunityPlace[];
  onSupport: (id: string) => void;
  onShowOnMap: (id: string) => void;
  visibleIds: string[];
};

export default function CommunityPanel({
  places,
  onSupport,
  onShowOnMap,
  visibleIds
}: CommunityPanelProps) {
  const sortedPlaces = [...places].sort((left, right) => right.votes - left.votes);

  return (
    <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--shadow)]">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Comunidad cofrade
        </p>
        <h2 className="text-lg font-semibold text-slate-900">Sitios compartidos por usuarios</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Puedes apoyar sitios y darles relevancia. Cuantos mas apoyos, mas arriba aparecen.
        </p>
      </div>

      {sortedPlaces.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-3 py-3 text-sm text-[var(--muted)]">
          Todavia no hay sitios compartidos. Comparte uno desde la lista de puntos.
        </p>
      ) : (
        <ul className="tour-scrollbar mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
          {sortedPlaces.map((place) => {
            const isVisible = visibleIds.includes(place.id);
            return (
              <li className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={place.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{place.name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{place.address || "Ubicacion compartida"}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                      Apoyos: {place.votes}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                      onClick={() => onSupport(place.id)}
                      type="button"
                    >
                      Apoyar
                    </button>
                    <button
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                      onClick={() => onShowOnMap(place.id)}
                      type="button"
                    >
                      {isVisible ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
