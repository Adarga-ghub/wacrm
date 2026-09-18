"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CreditCard,
  Loader2,
  MoreVertical,
  Copy,
  Palette,
  Pencil,
  Receipt,
  Settings,
  Trash2,
} from "lucide-react"

import { useCan } from "@/hooks/use-can"
import type { PaymentForm } from "@/types"
import { Button } from "@/components/ui/button"
import { GatedButton } from "@/components/ui/gated-button"
import { Badge } from "@/components/ui/badge"
import {
  ReorderableHeaderActions,
  type ReorderableAction,
} from "@/components/payments/reorderable-header-actions"
import { PaymentsLanguageToggle } from "@/components/payments/payments-language-toggle"
import { usePaymentsT } from "@/hooks/use-payments-locale"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const STATUS_BADGE: Record<PaymentForm["status"], string> = {
  draft: "border-slate-500/30 bg-slate-500/10 text-muted-foreground",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  archived: "border-slate-500/30 bg-slate-500/10 text-muted-foreground",
}

export default function PaymentsPage() {
  const router = useRouter()
  const t = usePaymentsT("list")
  const canManage = useCan("send-messages")

  const [forms, setForms] = useState<PaymentForm[] | null>(null)
  const [pendingArchive, setPendingArchive] = useState<PaymentForm | null>(null)
  const [archiving, setArchiving] = useState(false)

  async function load() {
    const res = await fetch("/api/payments/forms")
    if (!res.ok) {
      toast.error(t("loadFailed"))
      setForms([])
      return
    }
    const data = await res.json()
    setForms(data.forms ?? [])
  }

  // See the matching comment in the form editor page — same
  // established "fetch on mount" shape as other list pages in this
  // codebase (automations, broadcasts); flagged here over `load`'s
  // early-return branch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  async function handleDuplicate(form: PaymentForm) {
    const res = await fetch(`/api/payments/forms/${form.id}/duplicate`, { method: "POST" })
    if (!res.ok) {
      toast.error(t("duplicateFailed"))
      return
    }
    toast.success(t("duplicateSuccess"))
    load()
  }

  async function handleArchive() {
    if (!pendingArchive) return
    setArchiving(true)
    const res = await fetch(`/api/payments/forms/${pendingArchive.id}`, { method: "DELETE" })
    setArchiving(false)
    setPendingArchive(null)
    if (!res.ok) {
      toast.error(t("archiveFailed"))
      return
    }
    toast.success(t("archiveSuccess"))
    load()
  }

  // Each pill is independently draggable (see
  // `ReorderableHeaderActions`) — order is a per-device preference,
  // not app state, so it's fine to rebuild this array every render.
  const headerActions: ReorderableAction[] = [
    {
      id: "transactions",
      content: (
        <Button variant="outline" render={<Link href="/payments/transactions" />}>
          <Receipt className="h-4 w-4" />
          {t("transactions")}
        </Button>
      ),
    },
    {
      id: "gateway",
      content: (
        <Button variant="outline" render={<Link href="/payments/settings" />}>
          <Settings className="h-4 w-4" />
          {t("configureGateway")}
        </Button>
      ),
    },
    {
      id: "skins",
      content: (
        <Button variant="outline" render={<Link href="/payments/skins" />}>
          <Palette className="h-4 w-4" />
          {t("skins")}
        </Button>
      ),
    },
    {
      id: "new-form",
      content: (
        <GatedButton
          canAct={canManage}
          gateReason="create payment forms"
          onClick={() => router.push("/payments/forms/new")}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <CreditCard className="h-4 w-4" />
          {t("newForm")}
        </GatedButton>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PaymentsLanguageToggle />
          <ReorderableHeaderActions storageKey="wacrm:payments-header-order" actions={headerActions} />
        </div>
      </div>

      {forms === null ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CreditCard className="h-6 w-6" />
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
                <TableHead className="text-muted-foreground">{t("table.status")}</TableHead>
                <TableHead className="hidden text-muted-foreground sm:table-cell">
                  {t("table.amount")}
                </TableHead>
                <TableHead className="hidden text-muted-foreground sm:table-cell">
                  {t("table.created")}
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map((form) => (
                <TableRow
                  key={form.id}
                  className="cursor-pointer border-border hover:bg-muted/50"
                  onClick={() => router.push(`/payments/forms/${form.id}/edit`)}
                >
                  <TableCell className="font-medium text-foreground">{form.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE[form.status]}>
                      {t(`status.${form.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {form.amount_type === "fixed" && form.amount != null
                      ? `${form.amount} ${form.currency}`
                      : t("table.variableAmount")}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {new Date(form.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={t("actions.menu")}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/payments/forms/${form.id}/edit`)}
                        >
                          <Pencil className="h-4 w-4" />
                          {t("actions.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(form)}>
                          <Copy className="h-4 w-4" />
                          {t("actions.duplicate")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setPendingArchive(form)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("actions.archive")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!pendingArchive} onOpenChange={(v) => !v && setPendingArchive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("archiveTitle")}</DialogTitle>
            <DialogDescription>
              {t("archiveDesc", { name: pendingArchive?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingArchive(null)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" disabled={archiving} onClick={handleArchive}>
              {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("actions.archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
