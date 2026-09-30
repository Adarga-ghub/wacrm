// ============================================================
// CTA URL message — shared shape + validation.
//
// A WhatsApp "Call to Action URL" interactive message: body text plus a
// single button that opens an external URL (checkout pages, product
// pages, …). Unlike reply buttons it never produces a webhook tap, so
// flows/automations auto-advance after sending it.
//
// Used by BOTH the Flows `send_cta_url` node and the Automations
// `send_cta_url` step, so the builder form, the save-time validators
// and the engines all agree on one config shape.
//
// Visual header: WhatsApp can only render a text, image, video or
// document header — there is no "background color" knob in the Cloud
// API. The "solid color" option is therefore implemented as an image:
// the builder renders a flat PNG in the chosen color at the recommended
// size and uploads it, so `header_image_url` is always what gets sent
// and `header_color` only records which swatch produced it.
//
// Button alignment: WhatsApp always renders the CTA button full-width
// with its label centered under the bubble; the builder preview mirrors
// that. There is no API field to change it.
// ============================================================

import { INTERACTIVE_LIMITS } from './meta-api'

export type CtaHeaderMode = 'none' | 'image' | 'color'

export interface CtaUrlMessageConfig {
  /** Body text shown above the button (≤ 1024 chars). */
  body: string
  /** Visible, centered button label (≤ 20 chars per Meta). */
  button_text: string
  /** External http(s) URL the button opens. */
  url: string
  /** Header style — none, an uploaded image, or a solid color. */
  header_mode?: CtaHeaderMode
  /** Public URL of the header image (uploaded or generated from `header_color`). */
  header_image_url?: string
  /** Hex color (#rrggbb) used to generate the header image in `color` mode. */
  header_color?: string
  /** Optional plain-text header, only used in `none` mode (≤ 60 chars). */
  header_text?: string
  /** Optional grey footer line (≤ 60 chars). */
  footer?: string
}

/**
 * Header image size WhatsApp displays without cropping or letterboxing.
 * Interactive-message headers render at ~1.91:1; 1200×628 keeps the
 * image sharp on high-density screens while staying far below Meta's
 * 5 MB image cap. The solid-color generator uses the same size.
 */
export const CTA_HEADER_IMAGE = {
  width: 1200,
  height: 628,
  aspectLabel: '1.91:1',
  maxBytes: 5 * 1024 * 1024,
  accept: 'image/png,image/jpeg',
} as const

/** Curated solid-color headers offered as one-click swatches. */
export const CTA_COLOR_PRESETS = [
  '#25D366', // WhatsApp green
  '#128C7E', // teal
  '#2563EB', // blue
  '#7C3AED', // violet
  '#DB2777', // pink
  '#DC2626', // red
  '#EA580C', // orange
  '#F59E0B', // amber
  '#0F172A', // slate / near black
  '#6B7280', // grey
] as const

/** Meta's cap on the button label — same as INTERACTIVE_LIMITS.buttonTitleMaxLength.
 *  A literal (not a read of INTERACTIVE_LIMITS) so importing this module never
 *  touches meta-api at load time; tests that mock meta-api stay unaffected. */
export const CTA_BUTTON_TEXT_MAX = 20

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && HEX_COLOR.test(v)
}

/**
 * True for an absolute http(s) URL. `{{ … }}` placeholders are allowed
 * (they're interpolated at send time) and are treated as a plain token
 * for the parse check.
 */
export function isValidCtaUrl(raw: unknown): boolean {
  if (typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (!trimmed) return false
  const probe = trimmed.replace(/\{\{[^}]*\}\}/g, 'x')
  try {
    const u = new URL(probe)
    return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname
  } catch {
    return false
  }
}

/** The header image URL that should be sent, or undefined for no image. */
export function ctaHeaderImageUrl(cfg: Partial<CtaUrlMessageConfig>): string | undefined {
  const mode = cfg.header_mode ?? 'none'
  if (mode === 'none') return undefined
  const url = cfg.header_image_url?.trim()
  return url ? url : undefined
}

export type CtaUrlValidation =
  | { ok: true }
  | { ok: false; field: string; error: string }

/**
 * Validate a CTA URL config against Meta's limits + our structural rules.
 * Takes `unknown` so it's safe on a raw step_config / node config.
 */
export function validateCtaUrlConfig(raw: unknown): CtaUrlValidation {
  const c = (raw ?? {}) as Partial<CtaUrlMessageConfig>
  const body = typeof c.body === 'string' ? c.body : ''
  if (!body.trim()) return { ok: false, field: 'body', error: 'Body text is required.' }
  if (body.length > INTERACTIVE_LIMITS.bodyMaxLength) {
    return {
      ok: false,
      field: 'body',
      error: `Body exceeds the ${INTERACTIVE_LIMITS.bodyMaxLength}-character limit.`,
    }
  }
  const btn = typeof c.button_text === 'string' ? c.button_text.trim() : ''
  if (!btn) return { ok: false, field: 'button_text', error: 'Button text is required.' }
  if (btn.length > CTA_BUTTON_TEXT_MAX) {
    return {
      ok: false,
      field: 'button_text',
      error: `Button text exceeds the ${CTA_BUTTON_TEXT_MAX}-character limit.`,
    }
  }
  if (!isValidCtaUrl(c.url)) {
    return {
      ok: false,
      field: 'url',
      error: 'Button URL must be a full http(s) link, e.g. https://shop.example.com/pay.',
    }
  }
  const mode = c.header_mode ?? 'none'
  if (mode !== 'none' && mode !== 'image' && mode !== 'color') {
    return { ok: false, field: 'header_mode', error: 'Unknown header style.' }
  }
  if (mode === 'image' && !c.header_image_url?.trim()) {
    return { ok: false, field: 'header_image_url', error: 'Upload a header image or pick another header style.' }
  }
  if (mode === 'color') {
    if (!isHexColor(c.header_color)) {
      return { ok: false, field: 'header_color', error: 'Pick a background color.' }
    }
    if (!c.header_image_url?.trim()) {
      return { ok: false, field: 'header_color', error: 'The color header has not been generated yet — pick the color again.' }
    }
  }
  if (
    mode === 'none' &&
    c.header_text &&
    c.header_text.length > INTERACTIVE_LIMITS.headerTextMaxLength
  ) {
    return {
      ok: false,
      field: 'header_text',
      error: `Header exceeds the ${INTERACTIVE_LIMITS.headerTextMaxLength}-character limit.`,
    }
  }
  if (c.footer && c.footer.length > INTERACTIVE_LIMITS.footerMaxLength) {
    return {
      ok: false,
      field: 'footer',
      error: `Footer exceeds the ${INTERACTIVE_LIMITS.footerMaxLength}-character limit.`,
    }
  }
  return { ok: true }
}

/** Blank config used when a node/step is first added. */
export function blankCtaUrlConfig(): CtaUrlMessageConfig {
  return {
    body: '',
    button_text: 'Pay now',
    url: '',
    header_mode: 'none',
    header_image_url: '',
    header_color: CTA_COLOR_PRESETS[0],
    header_text: '',
    footer: '',
  }
}

/**
 * Text persisted on the CRM's own `messages` row so the inbox thread
 * shows what was sent (the button itself only exists on the phone).
 */
export function ctaUrlInboxText(body: string, buttonText: string, url: string): string {
  return `${body}\n\n🔗 ${buttonText}: ${url}`
}
