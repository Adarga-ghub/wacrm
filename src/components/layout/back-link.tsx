"use client"

import Link from "next/link"
import type { MouseEvent, ReactNode } from "react"

import { useSmartBack } from "@/hooks/use-smart-back"

/**
 * "Atrás"/"Volver" link used at the top of every child view in the
 * dashboard (product detail, form editor, skins, transactions, …).
 * Renders as a real `<Link href={href}>` — so hover previews,
 * middle-click, and ctrl/cmd-click "open in new tab" behave exactly
 * like a normal link, pointing at the fixed parent route — but a plain
 * left-click is intercepted to go back through the browser's real
 * history instead, when this tab actually has somewhere of ours to go
 * back to (see `useSmartBack`). That's what stops "Atrás" from always
 * jumping to the same fixed parent page regardless of where the user
 * actually came from.
 */
export function BackLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  const goBack = useSmartBack(href)

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.defaultPrevented || e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    goBack()
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  )
}
