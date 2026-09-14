// ============================================================
// Pure, unit-testable helpers for the per-conversation "typing…"
// status — mirrors src/lib/presence.ts's shape (derive staleness on
// the reading side rather than writing an explicit "stopped" row).
// See migration 045_conversation_typing.sql.
// ============================================================

/** A ping older than this reads as "not typing anymore". Short on
 *  purpose — this drives a live UI label, not a coarse roster. */
export const TYPING_STALE_AFTER_MS = 6_000;

export type TypingActorType = "agent" | "bot";

export interface ConversationTypingRow {
  actor_type: TypingActorType;
  updated_at: string;
}

/**
 * Is anyone currently typing on this conversation, right now? A
 * missing row, or one staler than TYPING_STALE_AFTER_MS, reads as
 * "no" — the same "derive absence from staleness" rule presence
 * uses, so a crashed tab or an LLM call that never finished cleanly
 * doesn't leave the header stuck on "Typing…" forever.
 */
export function deriveIsTyping(
  row: ConversationTypingRow | null | undefined,
  now: number,
): boolean {
  if (!row) return false;
  const last = new Date(row.updated_at).getTime();
  if (Number.isNaN(last)) return false;
  return now - last <= TYPING_STALE_AFTER_MS;
}
