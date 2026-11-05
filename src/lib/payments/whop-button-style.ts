/** The merchant's design for the Whop pay button on the checkout. */
export interface WhopButtonStyle {
  iconSize: number
  menuSize: number
  fontSize: number
  borderWidth: number
  fontFamily: WhopButtonFont
  backgroundColor: string
  textColor: string
  borderColor: string
}

export const WHOP_BUTTON_FONTS = {
  paypal: { label: 'PayPal Open', css: '"PayPal Open", Arial, sans-serif' },
  inter: { label: 'Inter', css: 'var(--font-sans), Arial, sans-serif' },
  openSans: { label: 'Open Sans', css: 'var(--font-open-sans), Arial, sans-serif' },
  arial: { label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
} as const

export type WhopButtonFont = keyof typeof WHOP_BUTTON_FONTS

export const DEFAULT_WHOP_BUTTON_STYLE: WhopButtonStyle = {
  iconSize: 36,
  menuSize: 26,
  fontSize: 15,
  borderWidth: 2,
  fontFamily: 'paypal',
  backgroundColor: '#ffffff',
  textColor: '#2b2b2b',
  borderColor: '#2b2b2b',
}

/** Allowed ranges: wide enough to design with, narrow enough that the button still fits on a phone. */
export const WHOP_BUTTON_LIMITS = {
  iconSize: { min: 20, max: 60 },
  menuSize: { min: 14, max: 40 },
  fontSize: { min: 12, max: 22 },
  borderWidth: { min: 0, max: 6 },
} as const

function clampedNumber(value: unknown, key: keyof typeof WHOP_BUTTON_LIMITS): number {
  const n = Number(value)
  if (value === null || value === '' || !Number.isFinite(n)) return DEFAULT_WHOP_BUTTON_STYLE[key]
  const { min, max } = WHOP_BUTTON_LIMITS[key]
  return Math.min(max, Math.max(min, Math.round(n)))
}

function hexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback
}

/**
 * Turns whatever is stored or sent into a safe, complete design: missing
 * or invalid values fall back to the default, numbers to their range.
 * Everything here ends up in the public checkout's styles, so nothing
 * passes through unchecked.
 */
export function normalizeWhopButtonStyle(input: unknown): WhopButtonStyle {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const d = DEFAULT_WHOP_BUTTON_STYLE
  return {
    iconSize: clampedNumber(raw.iconSize, 'iconSize'),
    menuSize: clampedNumber(raw.menuSize, 'menuSize'),
    fontSize: clampedNumber(raw.fontSize, 'fontSize'),
    borderWidth: clampedNumber(raw.borderWidth, 'borderWidth'),
    fontFamily:
      typeof raw.fontFamily === 'string' && Object.hasOwn(WHOP_BUTTON_FONTS, raw.fontFamily)
        ? (raw.fontFamily as WhopButtonFont)
        : d.fontFamily,
    backgroundColor: hexColor(raw.backgroundColor, d.backgroundColor),
    textColor: hexColor(raw.textColor, d.textColor),
    borderColor: hexColor(raw.borderColor, d.borderColor),
  }
}
