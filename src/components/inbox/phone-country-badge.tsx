"use client";

import { useMemo, useRef, useState } from "react";
import { getPhoneCountry } from "@/lib/whatsapp/phone-country";
import { cn } from "@/lib/utils";

/**
 * Small "[flag] Colombia +57" chip derived from the contact's calling code.
 * Uses flagcdn PNGs instead of emoji flags because Windows doesn't render
 * regional-indicator emoji (it shows "CO" letters instead of a flag).
 *
 * Draggable (mouse + touch) via a translate offset that lives only in
 * component state — the parent remounts it per conversation (`key`), so
 * every time a chat is opened it starts back at its default spot.
 * The drag is clamped to the offset parent (the messages area).
 */
export function PhoneCountryBadge({ phone, className }: { phone: string | null | undefined; className?: string }) {
  const country = useMemo(() => getPhoneCountry(phone), [phone]);
  const [imgFailed, setImgFailed] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const elRef = useRef<HTMLSpanElement>(null);
  const drag = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    min: { x: number; y: number };
    max: { x: number; y: number };
  } | null>(null);

  if (!country) return null;
  const code = country.iso.toLowerCase();

  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return;
    const el = elRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const r = el.getBoundingClientRect();
    const p = parent.getBoundingClientRect();
    // How far the chip can still travel in each direction from where it is now.
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
      min: { x: offset.x - (r.left - p.left), y: offset.y - (r.top - p.top) },
      max: { x: offset.x + (p.right - r.right), y: offset.y + (p.bottom - r.bottom) },
    };
    el.setPointerCapture(e.pointerId);
    setDragging(true);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const d = drag.current;
    if (!d) return;
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    setOffset({
      x: clamp(d.origX + e.clientX - d.startX, d.min.x, d.max.x),
      y: clamp(d.origY + e.clientY - d.startY, d.min.y, d.max.y),
    });
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <span
      ref={elRef}
      title={`${country.name} (+${country.dialCode})`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      className={cn(
        "inline-flex max-w-[14rem] shrink-0 touch-none select-none items-center gap-1.5 rounded-full border border-border bg-background/90 px-2.5 py-1 text-[11px] font-medium leading-4 text-foreground shadow-sm backdrop-blur",
        dragging ? "cursor-grabbing shadow-md" : "cursor-grab",
        // Docked at its default spot: flat top + no top border so it reads
        // as a tab hanging from the header. Fully rounded once moved.
        !dragging && offset.x === 0 && offset.y === 0 && "rounded-t-none border-t-0",
        className
      )}
    >
      {imgFailed ? (
        <span className="text-[9px] font-semibold text-muted-foreground">{country.iso}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://flagcdn.com/w40/${code}.png`}
          alt=""
          width={16}
          height={12}
          draggable={false}
          onError={() => setImgFailed(true)}
          className="pointer-events-none h-3 w-4 shrink-0 rounded-[2px] object-cover shadow-[0_0_0_0.5px_rgba(0,0,0,0.25)]"
        />
      )}
      <span className="truncate">{country.name}</span>
      <span className="text-muted-foreground">+{country.dialCode}</span>
    </span>
  );
}
