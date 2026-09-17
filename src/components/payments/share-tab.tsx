"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Copy, Link2, Loader2, Search, Trash2, X } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import type { PaymentLink } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface ContactHit {
  id: string
  name: string | null
  phone: string
}

/**
 * "Compartir" tab — the public form URL, plus the payment-link
 * generator. `sendAutomation` here is the actual control behind the
 * user's ask: a merchant-facing toggle, fixed server-side when the
 * link is created (`payment_links.send_automation`, migration 051),
 * for the case "ya le envié los archivos a este cliente, no
 * dispares la automatización otra vez".
 */
export function ShareTab({
  formId,
  formSlug,
  sendAutomationDefault,
}: {
  formId: string
  formSlug: string
  sendAutomationDefault: boolean
}) {
  const [links, setLinks] = useState<PaymentLink[] | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<ContactHit[]>([])
  const [selected, setSelected] = useState<ContactHit | null>(null)
  const [sendAutomation, setSendAutomation] = useState(sendAutomationDefault)
  const [amountOverride, setAmountOverride] = useState("")

  async function loadLinks() {
    const res = await fetch(`/api/payments/forms/${formId}/links`)
    if (!res.ok) return
    const data = await res.json()
    setLinks(data.links ?? [])
  }

  useEffect(() => {
    loadLinks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId])

  useEffect(() => {
    if (!query.trim() || selected) {
      setHits([])
      return
    }
    const handle = setTimeout(async () => {
      const supabase = createClient()
      const like = `%${query.trim()}%`
      const { data } = await supabase
        .from("contacts")
        .select("id, name, phone")
        .or(`name.ilike.${like},phone.ilike.${like}`)
        .limit(6)
      setHits(data ?? [])
    }, 300)
    return () => clearTimeout(handle)
  }, [query, selected])

  function resetDialog() {
    setQuery("")
    setHits([])
    setSelected(null)
    setSendAutomation(sendAutomationDefault)
    setAmountOverride("")
  }

  async function handleCreate() {
    setCreating(true)
    const res = await fetch(`/api/payments/forms/${formId}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: selected?.id ?? null,
        send_automation: sendAutomation,
        amount_override: amountOverride ? Number(amountOverride) : null,
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) {
      toast.error(data.error || "Could not create the link")
      return
    }
    const fullUrl = `${window.location.origin}${data.url}`
    await navigator.clipboard.writeText(fullUrl).catch(() => {})
    toast.success("Link copied to clipboard")
    setDialogOpen(false)
    resetDialog()
    loadLinks()
  }

  async function handleRevoke(id: string) {
    const res = await fetch(`/api/payments/links/${id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Could not revoke the link")
      return
    }
    setLinks((ls) => ls?.filter((l) => l.id !== id) ?? ls)
  }

  function copyLink(code?: string) {
    const url = code
      ? `${window.location.origin}/pay/${formSlug}?l=${code}`
      : `${window.location.origin}/pay/${formSlug}`
    navigator.clipboard.writeText(url).catch(() => {})
    toast.success("Link copied to clipboard")
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div>
            <Label className="text-muted-foreground">Public form URL</Label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-border bg-muted px-2.5 py-1.5 text-sm">
                /pay/{formSlug}
              </code>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => copyLink()}
                aria-label="Copy link"
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>

          <Dialog
            open={dialogOpen}
            onOpenChange={(v) => {
              setDialogOpen(v)
              if (!v) resetDialog()
            }}
          >
            <DialogTrigger
              render={
                <Button variant="outline">
                  <Link2 className="h-4 w-4" />
                  Generate a payment link
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate a payment link</DialogTitle>
                <DialogDescription>
                  Prefill a known contact and choose whether this specific link should
                  trigger the automation once paid.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">Contact (optional)</Label>
                  {selected ? (
                    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <span>
                        {selected.name || selected.phone}{" "}
                        <span className="text-muted-foreground">{selected.phone}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        aria-label="Clear selected contact"
                      >
                        <X className="size-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by name or phone"
                        className="pl-8"
                      />
                      {hits.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-popover shadow-md">
                          {hits.map((hit) => (
                            <button
                              key={hit.id}
                              type="button"
                              onClick={() => {
                                setSelected(hit)
                                setHits([])
                              }}
                              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                            >
                              <span>{hit.name || hit.phone}</span>
                              <span className="text-xs text-muted-foreground">{hit.phone}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Generate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground">Payment links</h3>
        {links === null ? (
          <Loader2 className="size-5 animate-spin text-primary" />
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No links generated yet.</p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {link.contact?.name || link.contact?.phone || "No contact"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(link.created_at).toLocaleDateString()}
                    {link.amount_override != null && ` · ${link.amount_override}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      link.send_automation
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    }
                  >
                    {link.send_automation ? "Automation on" : "Automation off"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => copyLink(link.code)}
                    aria-label="Copy link"
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRevoke(link.id)}
                    aria-label="Revoke link"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
