/**
 * Slugs back the public checkout URL (`/pay/[slug]`) and are globally
 * unique across every account (migration 050's `idx_payment_forms_slug`),
 * so a fresh one always mixes in a short random suffix rather than
 * relying on the name alone — two accounts naming a form "Curso Avanzado"
 * would otherwise collide on the very first save.
 */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return base || 'form'
}

export function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

export function generateSlug(name: string): string {
  return `${slugify(name)}-${randomSlugSuffix()}`
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 80 && SLUG_PATTERN.test(slug)
}
