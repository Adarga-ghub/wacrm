import { describe, expect, it } from "vitest";
import { deriveIsTyping, TYPING_STALE_AFTER_MS } from "./conversation-typing";

const NOW = new Date("2026-01-01T00:00:00Z").getTime();

describe("deriveIsTyping", () => {
  it("is false when there is no row at all", () => {
    expect(deriveIsTyping(null, NOW)).toBe(false);
    expect(deriveIsTyping(undefined, NOW)).toBe(false);
  });

  it("is true for a fresh ping", () => {
    expect(
      deriveIsTyping({ actor_type: "agent", updated_at: new Date(NOW).toISOString() }, NOW),
    ).toBe(true);
  });

  it("stays true right up to the staleness boundary", () => {
    const updatedAt = new Date(NOW - TYPING_STALE_AFTER_MS).toISOString();
    expect(deriveIsTyping({ actor_type: "bot", updated_at: updatedAt }, NOW)).toBe(true);
  });

  it("flips to false just past the staleness boundary", () => {
    const updatedAt = new Date(NOW - TYPING_STALE_AFTER_MS - 1).toISOString();
    expect(deriveIsTyping({ actor_type: "bot", updated_at: updatedAt }, NOW)).toBe(false);
  });

  it("is false for a malformed timestamp rather than throwing", () => {
    expect(deriveIsTyping({ actor_type: "agent", updated_at: "not-a-date" }, NOW)).toBe(false);
  });
});
