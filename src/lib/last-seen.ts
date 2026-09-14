// ============================================================
// "Última vez activo" (customer last-seen) — pure, unit-testable.
//
// WhatsApp never exposes a customer's real presence/last-seen to a
// business (confirmed against Meta's Cloud API docs — there is no
// such endpoint, for anyone). This is NOT that: it's a CRM-derived
// timestamp — the created_at of this contact's most recent INBOUND
// message, already sitting in our own `messages` table. Genuinely
// different data with a similar name, so the header label spells out
// "última actividad" rather than borrowing WhatsApp's own "last seen"
// wording, to avoid implying it's the same signal.
//
// Text is hardcoded Spanish, matching the rest of this header status
// (see the "En línea" → "Escribiendo…" work before it) — this app has
// no `es` locale, only `en`/`ko`.
// ============================================================

/**
 * Relative "última actividad" string for the chat header subtitle.
 * `null` when there is no inbound message to derive it from (e.g. a
 * conversation seeded by an outbound broadcast the contact never
 * replied to) — the caller decides whether to render anything at all
 * in that case.
 */
export function formatLastSeenEs(
  lastMessageAt: string | null | undefined,
  now: number,
): string | null {
  if (!lastMessageAt) return null;
  const last = new Date(lastMessageAt).getTime();
  if (Number.isNaN(last)) return null;

  const diff = Math.max(0, now - last);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Activo justo ahora";
  if (mins === 1) return "Activo hace 1 minuto";
  if (mins < 60) return `Activo hace ${mins} minutos`;

  const hours = Math.floor(mins / 60);
  if (hours === 1) return "Activo hace 1 hora";
  if (hours < 24) return `Activo hace ${hours} horas`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Activo hace 1 día";
  return `Activo hace ${days} días`;
}
