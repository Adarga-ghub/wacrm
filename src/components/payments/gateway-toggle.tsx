"use client"

import { Switch } from "@/components/ui/switch"

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
      <Switch checked={enabled} disabled={disabled} onCheckedChange={onChange} />
    </label>
  )
}
