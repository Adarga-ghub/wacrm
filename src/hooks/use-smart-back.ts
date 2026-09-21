"use client"

import { useRouter, usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

// sessionStorage (not localStorage) — deliberately scoped to this browser
// tab, the same lifetime as the actual back/forward history stack it's
// standing in for. A new tab (even on the same domain, e.g. middle-click
// "open in new tab") starts with none of this, so it falls back to the
// fixed parent route instead of guessing — safe either way, since that
// fallback is exactly today's behavior.
const SESSION_KEY = "wacrm.has-internal-history"

/**
 * Call once, high in the dashboard tree (see `DashboardShellInner`) —
 * marks this tab as having "internal history" the first time the
 * pathname changes after mount, so `useSmartBack` below can tell a
 * genuine in-app navigation apart from a fresh tab, a pasted URL, or a
 * page refresh with nothing meaningful to go back to.
 */
export function useTrackInternalNavigation() {
  const pathname = usePathname()
  const firstPathnameRef = useRef<string | null>(null)

  useEffect(() => {
    if (firstPathnameRef.current === null) {
      firstPathnameRef.current = pathname
      return
    }
    if (pathname !== firstPathnameRef.current) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1")
      } catch {
        // Private browsing / storage disabled — the "Atrás" links just
        // always fall back to their fixed parent route instead.
      }
    }
  }, [pathname])
}

/**
 * Returns a `goBack()` function for a page's "Atrás"/back link: replays
 * the browser's real back-navigation (`router.back()`) when this tab has
 * actually navigated within the app before landing here, so the user
 * returns to whichever specific page they came from — a product's own
 * page, a payment link, search results, etc. — instead of always
 * jumping to `fallbackHref`. Falls back to `router.push(fallbackHref)`
 * when there's nothing of ours to go back to (direct link, bookmark,
 * fresh tab, or a refresh before any in-app navigation happened).
 */
export function useSmartBack(fallbackHref: string) {
  const router = useRouter()

  return () => {
    let hasInternalHistory = false
    try {
      hasInternalHistory = sessionStorage.getItem(SESSION_KEY) === "1"
    } catch {
      // Fall through — treated the same as "no internal history".
    }
    if (hasInternalHistory) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }
}
