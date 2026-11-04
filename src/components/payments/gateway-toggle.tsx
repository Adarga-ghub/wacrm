"use client"

import { Switch } from "@/components/ui/switch"

// Off, the default switch nearly disappears on a dark card: a visible outline
// and thumb keep it readable as a button, including while it's locked.
const OFF_STYLE = [
  "disabled:opacity-100",
  "data-[unchecked]:border-slate-500 dark:data-[unchecked]:border-white",
  "data-[unchecked]:[&>[data-slot=switch-thumb]]:bg-slate-400 dark:data-[unchecked]:[&>[data-slot=switch-thumb]]:bg-slate-300",
].join(" ")

interface Props {
  enabled: boolean
  /** Off until the gateway has credentials, or for members who can't edit settings. */
  disabled: boolean
  onChange: (enabled: boolean) => void
  label: string
}

/** The on/off switch in a gateway card's header. Turning it off keeps the gateway's credentials. */
export function GatewayToggle({ enabled, disabled, onChange, label }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
      {label}
      <Switch className={OFF_STYLE} checked={enabled} disabled={disabled} onCheckedChange={onChange} />
    </label>
  )
}
