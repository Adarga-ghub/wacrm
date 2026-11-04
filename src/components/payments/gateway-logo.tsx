/**
 * A payment gateway's logo on its own white chip: the brands' dark
 * colors stay legible on the dashboard's dark theme too.
 */
export function GatewayLogo({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-white px-3 py-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- small local SVG, nothing to optimize */}
      <img src={src} alt={alt} className="h-6 w-auto" />
    </span>
  )
}
