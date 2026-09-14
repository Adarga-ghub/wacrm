import { describe, expect, it } from "vitest";
import { formatLastSeenEs } from "./last-seen";

const NOW = new Date("2026-01-01T12:00:00Z").getTime();

function minutesAgo(mins: number): string {
  return new Date(NOW - mins * 60_000).toISOString();
}
function hoursAgo(hours: number): string {
  return new Date(NOW - hours * 3_600_000).toISOString();
}
function daysAgo(days: number): string {
  return new Date(NOW - days * 86_400_000).toISOString();
}

describe("formatLastSeenEs", () => {
  it("is null when there is no timestamp", () => {
    expect(formatLastSeenEs(null, NOW)).toBeNull();
    expect(formatLastSeenEs(undefined, NOW)).toBeNull();
  });

  it("is null for a malformed timestamp rather than throwing", () => {
    expect(formatLastSeenEs("not-a-date", NOW)).toBeNull();
  });

  it("reads 'justo ahora' under a minute", () => {
    expect(formatLastSeenEs(minutesAgo(0), NOW)).toBe("Activo justo ahora");
  });

  it("singularizes exactly 1 minute", () => {
    expect(formatLastSeenEs(minutesAgo(1), NOW)).toBe("Activo hace 1 minuto");
  });

  it("pluralizes minutes", () => {
    expect(formatLastSeenEs(minutesAgo(45), NOW)).toBe("Activo hace 45 minutos");
  });

  it("singularizes exactly 1 hour", () => {
    expect(formatLastSeenEs(hoursAgo(1), NOW)).toBe("Activo hace 1 hora");
  });

  it("pluralizes hours", () => {
    expect(formatLastSeenEs(hoursAgo(5), NOW)).toBe("Activo hace 5 horas");
  });

  it("singularizes exactly 1 day", () => {
    expect(formatLastSeenEs(daysAgo(1), NOW)).toBe("Activo hace 1 día");
  });

  it("pluralizes days", () => {
    expect(formatLastSeenEs(daysAgo(9), NOW)).toBe("Activo hace 9 días");
  });
});
