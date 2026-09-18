"use client"

// ============================================================
// ReorderableHeaderActions — lets the merchant drag the Payments
// dashboard's header buttons (Transactions / Configure PayPal / New
// form / Payment Skins) into whatever order they check most. Order is
// a per-device UI preference, same tier as the accent theme
// (`src/hooks/use-theme.tsx`'s "localStorage only, device-scoped" —
// see that file's header comment for why that's an accepted tradeoff
// here rather than a `profiles.preferences` round trip).
//
// Built on `@dnd-kit` (already a dependency — see
// `src/components/pipelines/pipeline-board.tsx` /
// `pipeline-settings.tsx` for the vertical/kanban uses of the same
// library), just with `horizontalListSortingStrategy` instead.
// ============================================================

import { type ReactNode, useEffect, useState } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

export interface ReorderableAction {
  id: string
  content: ReactNode
}

function readStoredOrder(storageKey: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

/**
 * Reconciles a stored order against the actions actually present:
 * known ids keep the stored order, and any id missing from storage
 * (a brand-new button, or first-ever visit) is appended at the end in
 * its natural order.
 */
function reconcile(storedOrder: string[], ids: string[]): string[] {
  const idSet = new Set(ids)
  const kept = storedOrder.filter((id) => idSet.has(id))
  const missing = ids.filter((id) => !kept.includes(id))
  return [...kept, ...missing]
}

export function ReorderableHeaderActions({
  actions,
  storageKey,
}: {
  actions: ReorderableAction[]
  storageKey: string
}) {
  const ids = actions.map((a) => a.id)
  const [order, setOrder] = useState<string[]>(ids)

  // Reconcile against localStorage once mounted (SSR has no
  // `window`, so the first client render must start from the
  // natural/default order and only then adopt the stored one — doing
  // it inline during render would mismatch the server-rendered HTML).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder((current) => reconcile(readStoredOrder(storageKey), current))
    // Only ever needs to run once per mount — `ids` changing later
    // (e.g. a feature flag toggling a button) is handled by the
    // `reconcile` call in `handleDragEnd`/the render-time fallback
    // below, not by re-running this localStorage read.
  }, [storageKey])

  const sensors = useSensors(
    // 5px activation distance avoids clicks/navigation being interpreted as drags.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrder((current) => {
      const oldIndex = current.indexOf(String(active.id))
      const newIndex = current.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return current
      const next = arrayMove(current, oldIndex, newIndex)
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Private-browsing / storage-disabled — reordering still works
        // for the rest of this session, it just won't persist.
      }
      return next
    })
  }

  const byId = new Map(actions.map((a) => [a.id, a]))
  // Render-time reconcile (not just the mount effect) so a button
  // added/removed between renders never silently disappears or
  // crashes the lookup below.
  const orderedIds = reconcile(order, ids)
  const orderedActions = orderedIds
    .map((id) => byId.get(id))
    .filter((a): a is ReorderableAction => !!a)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedIds} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-wrap items-center gap-2">
          {orderedActions.map((action) => (
            <SortableAction key={action.id} id={action.id}>
              {action.content}
            </SortableAction>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableAction({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      // The whole pill is the drag handle (touch-none so a drag on a
      // touchscreen doesn't also scroll the page) — the 5px pointer
      // threshold above is what keeps a plain tap/click acting as a
      // normal click/navigation instead of a drag.
      className="touch-none cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}
