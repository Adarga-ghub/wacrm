// ============================================================
// GET /api/public/payments/geo
//
// Public — no auth required. Called once when /pay/[slug] mounts so
// the checkout page can pick a PayPal SDK locale that matches the
// buyer's actual country instead of defaulting to Spain for every
// Spanish-speaking visitor (see `resolvePaypalSdkLocale` in
// `pay-page-i18n.ts`). Best-effort only — on any failure this
// returns `{ country: null }` rather than erroring, so a slow or
// unreachable geolocation provider never blocks checkout.
// ============================================================

import { NextResponse } from "next/server";

/**
 * Best-effort client IP — same pattern as the invitations routes.
 * Falls back to `null` when no proxy is in front (e.g. localhost
 * during development), which skips the lookup entirely below.
 */
function getClientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return null;
}

function isPrivateOrLoopback(ip: string): boolean {
  return (
    ip === "unknown" ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!ip || isPrivateOrLoopback(ip)) {
    return NextResponse.json({ country: null });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return NextResponse.json({ country: null });
    const data = await res.json();
    const country = data?.success && typeof data.country_code === "string" ? data.country_code : null;
    return NextResponse.json({ country });
  } catch {
    return NextResponse.json({ country: null });
  }
}
