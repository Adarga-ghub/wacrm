"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Copy, Eye, Loader2, Palette, Pencil, Trash2 } from "lucide-react"

import { useCan } from "@/hooks/use-can"
import { BackLink } from "@/components/layout/back-link"
import type { PaymentForm, PaymentSkin } from "@/types"
import { Button } from "@/components/ui/button"
import { GatedButton } from "@/components/ui/gated-button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SkinEditorDialog } from "@/components/payments/skin-editor-dialog"
import { PaymentsLanguageToggle } from "@/components/payments/payments-language-toggle"
import { usePaymentsLocale, usePaymentsT } from "@/hooks/use-payments-locale"
import { buildSkinPreviewUrl } from "@/lib/payments/skin-preview"

export default function PaymentSkinsPage() {
  const t = usePaymentsT("skins")
  const { locale } = usePaymentsLocale()
  const canManage = useCan("send-messages")

  const [skins, setSkins] = useState<PaymentSkin[] | null>(null)
  const [forms, setForms] = useState<PaymentForm[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSkin, setEditingSkin] = useState<PaymentSkin | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PaymentSkin | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  async function load() {
    const [skinsRes, formsRes] = await Promise.all([
      fetch("/api/payments/skins"),
      fetch("/api/payments/forms"),
    ])
    if (!skinsRes.ok) {
      toast.error(t("loadFailed"))
      setSkins([])
    } else {
      const data = await skinsRes.json()
      setSkins(data.skins ?? [])
    }
    if (formsRes.ok) {
      const data = await formsRes.json()
      setForms(data.forms ?? [])
    }
  }

  // Same "fetch on mount" shape as the rest of this module's list
  // pages (see the matching comment in `payments/page.tsx`).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  function openCreate() {
    setEditingSkin(null)
    setDialogOpen(true)
  }

  function openEdit(skin: PaymentSkin) {
    setEditingSkin(skin)
    setDialogOpen(true)
  }

  function handlePreview(skin: PaymentSkin) {
    window.open(buildSkinPreviewUrl(skin.design, locale), "_blank", "noopener,noreferrer")
  }

  async function handleDuplicate(skin: PaymentSkin) {
    setDuplicatingId(skin.id)
    const res = await fetch("/api/payments/skins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${skin.name}${t("duplicateNameSuffix")}`,
        design: skin.design,
      }),
    })
    setDuplicatingId(null)
    if (!res.ok) {
      toast.error(t("duplicateFailed"))
      return
    }
    toast.success(t("duplicateSuccess"))
    load()
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    const res = await fetch(`/api/payments/skins/${pendingDelete.id}`, { method: "DELETE" })
    setDeleting(false)
    setPendingDelete(null)
    if (!res.ok) {
      toast.error(t("deleteFailed"))
      return
    }
    toast.success(t("deleteSuccess"))
    load()
  }

  const formCountBySkin = new Map<string, number>()
  for (const form of forms) {
    if (!form.skin_id) continue
    formCountBySkin.set(form.skin_id, (formCountBySkin.get(form.skin_id) ?? 0) + 1)
  }

  return (
    <div className="space-y-6">
      <BackLink
        href="/payments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </BackLink>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PaymentsLanguageToggle />
          <GatedButton
            canAct={canManage}
            gateReason="create payment skins"
            onClick={openCreate}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Palette className="h-4 w-4" />
            {t("newSkin")}
          </GatedButton>
        </div>
      </div>

      {skins === null ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : skins.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Palette className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t("emptyTitle")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t("emptyDesc")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">{t("table.name")}</TableHead>
                <TableHead className="text-muted-foreground">{t("table.forms")}</TableHead>
                <TableHead className="hidden text-muted-foreground sm:table-cell">
                  {t("table.created")}
                </TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {skins.map((skin) => (
                <TableRow
                  key={skin.id}
                  className="cursor-pointer border-border hover:bg-muted/50"
                  onClick={() => openEdit(skin)}
                >
                  <TableCell className="font-medium text-foreground">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-4 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: skin.design?.accent_color || "#16a34a" }}
                      />
                      {skin.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {t("table.formsCount", { count: formCountBySkin.get(skin.id) ?? 0 })}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {new Date(skin.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handlePreview(skin)}
                        aria-label={t("preview")}
                        title={t("preview")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(skin)}
                        aria-label={t("actions.edit")}
                        title={t("actions.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDuplicate(skin)}
                        disabled={duplicatingId === skin.id}
                        aria-label={t("actions.duplicate")}
                        title={t("actions.duplicate")}
                      >
                        {duplicatingId === skin.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPendingDelete(skin)}
                        aria-label={t("actions.delete")}
                        title={t("actions.delete")}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <SkinEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        skin={editingSkin}
        forms={forms}
        onSaved={load}
        t={t}
      />

      <Dialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteDesc", { name: pendingDelete?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
