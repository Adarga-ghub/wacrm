/**
 * Max lengths for the checkout's editable copy. One source of truth for
 * the admin inputs (`maxLength` + the "n/max" counter) and the API
 * routes that save them (which reject anything longer), so a text that
 * fits in the editor always fits on the checkout.
 *
 * The order-bump numbers are sized to the bump box: every box on the
 * checkout has the same fixed height (title clamped to 2 lines,
 * description to 2 lines), and these limits keep the text from being
 * cut off at the usual card width.
 */
export const CHECKOUT_TEXT_LIMITS = {
  /** "¡No te pierdas estas increíbles ofertas!" — one line above the bumps. */
  bumpHeading: 60,
  /** Bump box title — 2 lines. */
  bumpTitle: 80,
  /** Bump box description — 2 lines in the box, shown in full in the preview pop-up. */
  bumpDescription: 150,
  /** "¡Adquiere tu regalo!" — one line next to the logo. */
  urgencyText: 40,
} as const

/** Preview pop-up: main (mockup) image + up to 5 thumbnails' worth of pages. */
export const BUMP_GALLERY_MAX_IMAGES = 6

/**
 * Pop-up image size. The pop-up's main image sits in a fixed frame of
 * these proportions (11:15 — the shape of the book mockup), so an image
 * of exactly this shape fills it with no white bands; this size is
 * ~3× the frame's on-screen size, so it stays sharp.
 */
export const BUMP_GALLERY_IMAGE = { width: 1100, height: 1500 } as const

/** How far an upload's proportions may drift from 11:15 and still be accepted (2%). */
const BUMP_GALLERY_RATIO_TOLERANCE = 0.02

/**
 * Whether an image may be ADDED to a bump's pop-up gallery: the right
 * shape (within 2%) and at least `BUMP_GALLERY_IMAGE` in both sides —
 * bigger is fine, it's just sharper. Images saved before this rule
 * existed are kept; the admin only flags them.
 */
export function isValidBumpGalleryImageSize(width: number, height: number): boolean {
  if (!(width > 0 && height > 0)) return false
  const target = BUMP_GALLERY_IMAGE.width / BUMP_GALLERY_IMAGE.height
  const drift = Math.abs(width / height - target) / target
  return drift <= BUMP_GALLERY_RATIO_TOLERANCE && width >= BUMP_GALLERY_IMAGE.width && height >= BUMP_GALLERY_IMAGE.height
}

/** Longest countdown the urgency timer can be set to (it shows 2-digit hours). */
export const URGENCY_MAX_HOURS = 99

/**
 * Validates a text field from an admin request body against its limit:
 * `undefined` = not sent, `null` = cleared, a trimmed string = set,
 * `'too_long'` = reject with a 400.
 */
export function parseLimitedText(value: unknown, max: number): string | null | undefined | 'too_long' {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  return trimmed.length > max ? 'too_long' : trimmed
}

/**
 * Validates `gallery_images` from an admin request body: an array of
 * up to `BUMP_GALLERY_MAX_IMAGES` http(s) URLs. `undefined` = not sent,
 * `'invalid'` = reject with a 400.
 */
export function parseGalleryImages(value: unknown): string[] | undefined | 'invalid' {
  if (value === undefined) return undefined
  if (value === null) return []
  if (!Array.isArray(value) || value.length > BUMP_GALLERY_MAX_IMAGES) return 'invalid'
  const urls: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !/^https?:\/\//i.test(item.trim())) return 'invalid'
    urls.push(item.trim())
  }
  return urls
}

/** Countdown length in seconds for an urgency config — 0 when unset. */
export function urgencyDurationSeconds(u: { hours?: number; minutes?: number; seconds?: number } | undefined): number {
  if (!u) return 0
  const clamp = (n: unknown, max: number) => Math.min(max, Math.max(0, Math.floor(Number(n) || 0)))
  return clamp(u.hours, URGENCY_MAX_HOURS) * 3600 + clamp(u.minutes, 59) * 60 + clamp(u.seconds, 59)
}

/** The error to return (400) when a design's editable copy is over its limit, else null. Shared by the skin and form save routes. */
export function designTextError(design: { urgency?: { text?: string } } | null | undefined): string | null {
  const text = design?.urgency?.text
  if (typeof text === 'string' && text.trim().length > CHECKOUT_TEXT_LIMITS.urgencyText) {
    return `Urgency text max ${CHECKOUT_TEXT_LIMITS.urgencyText} characters`
  }
  return null
}
