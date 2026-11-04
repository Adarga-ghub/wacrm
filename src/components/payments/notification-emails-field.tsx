"use client"

import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MAX_NOTIFICATION_EMAILS } from "@/lib/payments/notification-emails"

interface Props {
  /** Always at least one entry, so there's a field to type in. */
  emails: string[]
  onChange: (emails: string[]) => void
  disabled: boolean
  label: string
  hint: string
  addLabel: string
  removeLabel: string
}

/** The "new payment received" addresses on a gateway card: one field, plus up to two more on demand. */
export function NotificationEmailsField({ emails, onChange, disabled, label, hint, addLabel, removeLabel }: Props) {
  return (
    <div className="grid gap-2">
      <Label className="text-muted-foreground">{label}</Label>
      {emails.map((email, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => onChange(emails.map((v, i) => (i === index ? e.target.value : v)))}
            disabled={disabled}
            placeholder="ventas@tunegocio.com"
          />
          {emails.length > 1 && !disabled && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={removeLabel}
              onClick={() => onChange(emails.filter((_, i) => i !== index))}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      ))}
      {emails.length < MAX_NOTIFICATION_EMAILS && !disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => onChange([...emails, ""])}
        >
          <Plus className="size-4" />
          {addLabel}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
