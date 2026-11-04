/** How many "new payment received" addresses each gateway card accepts. */
export const MAX_NOTIFICATION_EMAILS = 3

/**
 * Cleans the merchant's alert addresses: trims, drops blanks and
 * duplicates. Returns `null` when one isn't an email or there are too many.
 */
export function normalizeNotificationEmails(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null
  const emails = [
    ...new Set(
      input.filter((e): e is string => typeof e === 'string').map((e) => e.trim()).filter(Boolean),
    ),
  ]
  if (emails.length > MAX_NOTIFICATION_EMAILS) return null
  return emails.every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) ? emails : null
}
