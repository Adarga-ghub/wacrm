"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CreditCard, Loader2 } from "lucide-react"

import type { PaymentForm } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/**
 * "Cobrar" — the Inbox's own entry point into the payments module.
 * Generates a `payment_links` row prefilled with the open
 * conversation's contact (so a webhook/capture that completes later
 * resolves straight back to this same contact) and sends the URL as
 * a normal text message in the same conversation via the existing
 * `/api/whatsapp/send` — no new send path, just a shortcut to the
 * one that already exists.
 */
export function ChargeFromConversationDialog({
  contactId,
  conversationId,
}: {
  contactId: string
  conversationId: string
}) {
  const [open, setOpen] = useState(false)
  const [forms, setForms] = useState<PaymentForm[] | null>(null)
  const [formId, setFormId] = useState("")
  const [sendAutomation, setSendAutomation] = useState(true)
  const [amountOverride, setAmountOverride] = useState("")
  const [sending, setSending] = useState(false)

  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && forms === null) {
      const res = await fetch("/api/payments/forms")
      if (res.ok) {
        const data = await res.json()
        const published = (data.forms as PaymentForm[]).filter((f) => f.status === "published")
        setForms(published)
        if (published[0]) {
          setFormId(published[0].id)
          setSendAutomation(published[0].send_automation_default)
        }
      } else {
        setForms([])
      }
    }
  }

  function selectForm(id: string) {
    setFormId(id)
    const f = forms?.find((x) => x.id === id)
    if (f) setSendAutomation(f.send_automation_default)
  }

  async function handleSend() {
    if (!formId) return
    setSending(true)
    try {
      const linkRes = await fetch(`/api/payments/forms/${formId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          send_automation: sendAutomation,
          amount_override: amountOverride ? Number(amountOverride) : null,
        }),
      })
      const linkData = await linkRes.json()
      if (!linkRes.ok) {
        toast.error(linkData.error || "Could not create the payment link")
        return
      }
      const fullUrl = `${window.location.origin}${linkData.url}`

      const sendRes = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          message_type: "text",
          content_text: fullUrl,
        }),
      })
      if (!sendRes.ok) {
        toast.error("Link created, but sending it failed — copy it manually: " + fullUrl)
        return
      }
      toast.success("Payment link sent")
      setOpen(false)
      setAmountOverride("")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="Charge"
            title="Charge"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CreditCard className="h-3.5 w-3.5" />
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Charge this contact</DialogTitle>
          <DialogDescription>
            Generates a payment link and sends it in this conversation.
          </DialogDescription>
        </DialogHeader>

        {forms === null ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : forms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any published payment forms yet.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">Payment form</Label>
              <select
                value={formId}
                onChange={(e) => selectForm(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Send automation on payment
                </p>
                <p className="text-xs text-muted-foreground">
                  Turn off if you already sent the files to this contact.
                </p>
              </div>
              <Switch checked={sendAutomation} onCheckedChange={(v) => setSendAutomation(!!v)} />
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">Custom amount (optional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountOverride}
                onChange={(e) => setAmountOverride(e.target.value)}
                placeholder="Use the form's amount"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !formId}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Generate and send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
