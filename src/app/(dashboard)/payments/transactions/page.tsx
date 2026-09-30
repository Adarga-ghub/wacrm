"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { isToday, isYesterday, startOfDay, subDays } from "date-fns"
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronDown,
  CreditCard,
  Eye,
  Loader2,
  Trash2,
} from "lucide-react"

import type { PaymentTransaction, PaymentTransactionStatus } from "@/types"
import { usePaymentsT } from "@/hooks/use-payments-locale"
import { cn } from "@/lib/utils"
import { BackLink } from "@/components/layout/back-link"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const STATUS_BADGE: Record<PaymentTransactionStatus, string> = {
  created: "border-slate-500/30 bg-slate-500/10 text-muted-foreground",
  approved: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  refunded: "border-amber-500/30 bg-amber-500/10 text-amber-300",
}

/** `conversation_id` is resolved server-side so rows can deep-link to the Inbox. */
type TransactionRow = PaymentTransaction & { conversation_id: string | null }

// Same ranges (and the same rolling-window semantics) as the Inbox's
// date filter in `components/inbox/conversation-list.tsx`.
type DateRangeFilter = "all" | "today" | "yesterday" | "last3days" | "last7days"
const DATE_RANGES: DateRangeFilter[] = ["all", "today", "yesterday", "last3days", "last7days"]

function inDateRange(iso: string, range: DateRangeFilter): boolean {
  if (range === "all") return true
  const createdAt = new Date(iso)
  if (range === "today") return isToday(createdAt)
  if (range === "yesterday") return isYesterday(createdAt)
  // Rolling windows: today plus the previous 2 / 6 days.
  if (range === "last3days") return createdAt >= subDays(startOfDay(new Date()), 2)
  return createdAt >= subDays(startOfDay(new Date()), 6)
}

function contactLabel(txn: TransactionRow): string {
  return txn.contact?.name || txn.whatsapp_phone || "—"
}

export default function PaymentTransactionsPage() {
  const tList = usePaymentsT("list")
  const t = usePaymentsT("transactions")
  const [transactions, setTransactions] = useState<TransactionRow[] | null>(null)
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all")
  const [pendingDelete, setPendingDelete] = useState<TransactionRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    const res = await fetch("/api/payments/transactions")
    if (!res.ok) {
      toast.error(t("loadFailed"))
      setTransactions([])
      return
    }
    const data = await res.json()
    setTransactions(data.transactions ?? [])
  }

  useEffect(() => {
    // Standard "fetch on mount" shape — see the matching comment in
    // the form editor page for why this specific check flags it here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // Mount-only: `load` closes over `t` just for the error toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = useMemo(
    () => (transactions ?? []).filter((txn) => inDateRange(txn.created_at, dateRange)),
    [transactions, dateRange],
  )

  async function handleDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/payments/transactions/${pendingDelete.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || t("deleteFailed"))
        return
      }
      const deletedId = pendingDelete.id
      setTransactions((prev) => prev?.filter((txn) => txn.id !== deletedId) ?? prev)
      setPendingDelete(null)
      toast.success(t("deleteSuccess"))
    } catch {
      toast.error(t("deleteFailed"))
    } finally {
      setDeleting(false)
    }
  }

  const iconButton = buttonVariants({ variant: "ghost", size: "icon-xs" })

  return (
    <div className="space-y-6">
      <BackLink
        href="/payments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {tList("title")}
      </BackLink>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="flex items-center gap-3">
          {transactions !== null && transactions.length > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("count", { count: visible.length })}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors hover:bg-muted",
                dateRange !== "all"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Calendar className="size-3.5" />
              {t(`date.${dateRange}`)}
              <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-border bg-popover">
              {DATE_RANGES.map((range) => (
                <DropdownMenuItem
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={cn(
                    "text-sm",
                    dateRange === range ? "text-primary" : "text-popover-foreground",
                  )}
                >
                  {t(`date.${range}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {transactions === null ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CreditCard className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            {transactions.length === 0 ? t("empty") : t("emptyFiltered")}
          </p>
          {transactions.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setDateRange("all")}>
              {t("clearFilter")}
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">{t("table.date")}</TableHead>
                <TableHead className="text-muted-foreground">{t("table.form")}</TableHead>
                <TableHead className="text-muted-foreground">{t("table.contact")}</TableHead>
                <TableHead className="text-right text-muted-foreground">{t("table.amount")}</TableHead>
                <TableHead className="text-muted-foreground">{t("table.status")}</TableHead>
                <TableHead className="text-muted-foreground">{t("table.automation")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((txn) => (
                <TableRow key={txn.id} className="group border-border">
                  <TableCell className="text-muted-foreground">
                    {new Date(txn.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-foreground">{txn.form?.name ?? "—"}</TableCell>
                  <TableCell className="text-foreground">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{contactLabel(txn)}</span>
                      {/* Row actions — dimmed until the row is hovered/focused
                          so the log stays readable, but always visible for
                          touch screens. */}
                      <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        {txn.conversation_id ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Link
                                  href={`/inbox?c=${txn.conversation_id}`}
                                  aria-label={t("actions.openChat")}
                                  className={cn(iconButton, "text-muted-foreground hover:text-primary")}
                                />
                              }
                            >
                              <Eye />
                            </TooltipTrigger>
                            <TooltipContent side="top">{t("actions.openChat")}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <span
                                  role="button"
                                  aria-disabled="true"
                                  aria-label={t("actions.noChat")}
                                  className={cn(iconButton, "cursor-not-allowed text-muted-foreground/40")}
                                />
                              }
                            >
                              <Eye />
                            </TooltipTrigger>
                            <TooltipContent side="top">{t("actions.noChat")}</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={() => setPendingDelete(txn)}
                                aria-label={t("actions.delete")}
                                className={cn(
                                  iconButton,
                                  "text-muted-foreground hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20",
                                )}
                              />
                            }
                          >
                            <Trash2 />
                          </TooltipTrigger>
                          <TooltipContent side="top">{t("actions.delete")}</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    {txn.amount} {txn.currency}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE[txn.status]}>
                      {t(`status.${txn.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {txn.status !== "completed" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : txn.automation_dispatched_at ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      >
                        {t("automation.sent")}
                      </Badge>
                    ) : txn.send_automation ? (
                      <span className="text-muted-foreground">{t("automation.pending")}</span>
                    ) : (
                      <Badge variant="outline">{t("automation.off")}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(v) => !v && !deleting && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {pendingDelete &&
                t("deleteDesc", {
                  amount: `${pendingDelete.amount} ${pendingDelete.currency}`,
                  contact: contactLabel(pendingDelete),
                  date: new Date(pendingDelete.created_at).toLocaleString(),
                })}
            </DialogDescription>
          </DialogHeader>
          {pendingDelete?.status === "completed" && (
            <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{t("deleteCompletedWarning")}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setPendingDelete(null)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t("deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
