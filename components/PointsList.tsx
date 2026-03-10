"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { MapPoint } from "@/lib/types";
import {
  formatCoordinates,
  formatDistance,
  formatDuration
} from "@/lib/utils";

type PointsListProps = {
  points: MapPoint[];
  orderedPointIds: string[];
  canReorder: boolean;
  isReordering?: boolean;
  onFocusPoint: (id: string) => void;
  onRemovePoint: (id: string) => void;
  onRenamePoint: (id: string, name: string) => void;
  onReorderPointOrder: (nextOrder: string[]) => void;
  onSharePoint: (id: string) => void;
};

export default function PointsList({
  points,
  orderedPointIds,
  canReorder,
  isReordering = false,
  onFocusPoint,
  onRemovePoint,
  onRenamePoint,
  onReorderPointOrder,
  onSharePoint
}: PointsListProps) {
  const pointLookup = new Map(points.map((point) => [point.id, point]));
  const createdOrder = [...points]
    .sort((left, right) => left.createdOrder - right.createdOrder)
    .map((point) => point.id);
  const normalizedPointOrder = normalizePointOrder(orderedPointIds, createdOrder, points);
  const sortedPoints = normalizedPointOrder
    .map((pointId) => pointLookup.get(pointId))
    .filter(Boolean) as MapPoint[];
  const canUseDragAndDrop = canReorder && sortedPoints.length > 1 && !isReordering;
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 6
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 120,
        tolerance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = normalizedPointOrder.indexOf(String(active.id));
    const newIndex = normalizedPointOrder.indexOf(String(over.id));

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      return;
    }

    onReorderPointOrder(arrayMove(normalizedPointOrder, oldIndex, newIndex));
  }

  return (
    <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--shadow)]">
      <div className="mb-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Puntos
        </p>
        <h2 className="text-xl font-semibold text-slate-900">Paradas cargadas</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Edita nombres, centra ubicaciones y reordena por arrastrar y soltar en escritorio y movil.
        </p>
      </div>

      {sortedPoints.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-sm leading-6 text-[var(--muted)]">
          Todavia no hay puntos. Busca una ubicacion o toca el mapa para anadirla.
        </p>
      ) : (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext
            items={normalizedPointOrder}
            strategy={verticalListSortingStrategy}
          >
            <ul className="tour-scrollbar max-h-[34rem] space-y-3 overflow-y-auto pr-1">
              {sortedPoints.map((point, index) => (
                <SortablePointRow
                  canDrag={canUseDragAndDrop}
                  index={index}
                  key={point.id}
                  onFocusPoint={onFocusPoint}
                  onRemovePoint={onRemovePoint}
                  onRenamePoint={onRenamePoint}
                  onSharePoint={onSharePoint}
                  point={point}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function SortablePointRow({
  point,
  index,
  canDrag,
  onFocusPoint,
  onRemovePoint,
  onRenamePoint,
  onSharePoint
}: {
  point: MapPoint;
  index: number;
  canDrag: boolean;
  onFocusPoint: (id: string) => void;
  onRemovePoint: (id: string) => void;
  onRenamePoint: (id: string, name: string) => void;
  onSharePoint: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: point.id,
    disabled: !canDrag
  });
  const badge = typeof point.routeIndex === "number" ? point.routeIndex + 1 : index + 1;

  return (
    <li
      className={`rounded-2xl border border-slate-200 bg-slate-50 p-3 ${
        isDragging ? "opacity-90 shadow-lg" : ""
      }`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-semibold text-[var(--accent-strong)]">
          {badge}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              onChange={(event) => onRenamePoint(point.id, event.target.value)}
              placeholder={`Punto ${badge}`}
              value={point.name}
            />
            <button
              {...attributes}
              {...listeners}
              className="touch-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canDrag}
              type="button"
            >
              Arrastrar
            </button>
          </div>

          <div className="mt-3 space-y-1 text-sm leading-5 text-[var(--muted)]">
            {point.address ? <p>{point.address}</p> : null}
            <p>Coords: {formatCoordinates(point.lat, point.lon)}</p>
            {point.placeType ? <p>Tipo: {point.placeType}</p> : null}
            {typeof point.routeIndex === "number" ? (
              <p>Orden de visita: {point.routeIndex + 1}</p>
            ) : null}
            {typeof point.routeIndex === "number" && point.routeIndex > 0 ? (
              <p>
                Desde el punto anterior: {formatDistance(point.distanceFromPrevious)} |{" "}
                {formatDuration(point.durationFromPrevious)}
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
              onClick={() => onFocusPoint(point.id)}
              type="button"
            >
              Centrar
            </button>
            <button
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
              onClick={() => onSharePoint(point.id)}
              type="button"
            >
              Compartir
            </button>
            <button
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
              onClick={() => onRemovePoint(point.id)}
              type="button"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function normalizePointOrder(candidateOrder: string[], fallbackOrder: string[], points: MapPoint[]) {
  const pointIds = new Set(points.map((point) => point.id));
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const pointId of candidateOrder) {
    if (!pointIds.has(pointId) || seen.has(pointId)) {
      continue;
    }

    seen.add(pointId);
    normalized.push(pointId);
  }

  for (const pointId of fallbackOrder) {
    if (!pointIds.has(pointId) || seen.has(pointId)) {
      continue;
    }

    seen.add(pointId);
    normalized.push(pointId);
  }

  for (const point of points) {
    if (seen.has(point.id)) {
      continue;
    }

    seen.add(point.id);
    normalized.push(point.id);
  }

  return normalized;
}
