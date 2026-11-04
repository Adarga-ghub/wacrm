"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

// Root: primary token when checked (responds to the active color theme).
// Unchecked, a visible outline and thumb keep it readable as a button on
// dark cards, where the muted track alone nearly disappears.
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-70",
        "data-[checked]:bg-primary data-[unchecked]:bg-muted",
        "data-[unchecked]:border-slate-500 dark:data-[unchecked]:border-white",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-card shadow-sm ring-0 transition-transform",
          "data-[checked]:translate-x-4 data-[unchecked]:translate-x-0",
          "data-[unchecked]:bg-slate-400 dark:data-[unchecked]:bg-slate-300",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
