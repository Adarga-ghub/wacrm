"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { isToday, isYesterday, startOfDay, subDays } from "date-fns"
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Circle,
  Eye,
  Filter,
  Loader2,
  Trash2,
  TrendingUp,
} from "lucide-react"

import type { CheckoutSession, CheckoutSessionStatus } from "@/types"
import { usePaymentsT } from "@/hooks/use-payments-locale"
import { effectiveCheckoutStatus } from "@/lib/payments/checkout-tracking"
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

const STATUS_BADGE: Record<CheckoutSessionStatus, string> = {
  viewed: "border-slate-500/30 bg-slate-500/10 text-muted-foreground",
  initiated: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  abandoned: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
}

const STATUSES: CheckoutSessionStatus[] = ["viewed", "initiated", "abandoned", "completed"]

// Same ranges (and rolling-window semantics) as the Transactions tab.
type DateRangeFilter = "all" | "today" | "yesterday" | "last3days" | "last7days"
const DATE_RANGES: DateRangeFilter[] = ["all", "today", "yesterday", "last3days", "last7days"]

function inDateRange(iso: string, range: DateRangeFilter): boolean {
  if (range === "all") return true
  const date = new Date(iso)
  if (range === "today") return isToday(date)
  if (range === "yesterday") return isYesterday(date)
  if (range === "last3days") return date >= subDays(startOfDay(new Date()), 2)
  return date >= subDays(startOfDay(new Date()), 6)
}

/** Time only for today's events, date + time otherwise — keeps the indicator columns narrow. */
function formatStamp(iso: string): string {
  const date = new Date(iso)
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  if (isToday(date)) return time
  return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${time}`
}

/** `conversation_id` is resolved server-side so rows can deep-link to the Inbox. */
type Row = CheckoutSession & {
  conversation_id: string | null
  effectiveStatus: CheckoutSessionStatus
}

function contactName(s: CheckoutSession): string | null {
  return s.contact?.name && s.contact.name !== s.contact.phone ? s.contact.name : null
}

function contactPhone(s: CheckoutSession): string | null {
  return s.telefono ? `+${s.telefono}` : s.contact?.phone ?? null
}

function StepIndicator({ at, notYet }: { at: string | null; notYet: string }) {
  if (!at) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground/60">
        <Circle className="size-3.5" />
        <span className="text-xs">{notYet}</span>
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-foreground"
      title={new Date(at).toLocaleString()}
    >
      <CheckCircle2 className="size-3.5 text-emerald-400" />
      <span className="tabular-nums">{formatStamp(at)}</span>
    </span>
  )
}

export default function CheckoutAnalyticsPage() {
  const tList = usePaymentsT("list")
  const t = usePaymentsT("checkoutAnalytics")
  // Date-range labels are shared with the Transactions tab.
  const tTransactions = usePaymentsT("transactions")
  const [sessions, setSessions] = useState<Row[] | null>(null)
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all")
  const [statusFilter, setStatusFilter] = useState<CheckoutSessionStatus | "all">("all")
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    const res = await fetch("/api/payments/checkout-sessions")
    if (!res.ok) {
      toast.error(t("loadFailed"))
      setSessions([])
      return
    }
    const data = await res.json()
    // Effective status is resolved once per load, against the clock at
    // fetch time — the server sweep may lag a stale 'initiated' row.
    const now = Date.now()
    setSessions(
      ((data.sessions ?? []) as Omit<Row, "effectiveStatus">[]).map((s) => ({
        ...s,
        effectiveStatus: effectiveCheckoutStatus(s.status, s.last_activity_at, now),
      })),
    )
  }

  useEffect(() => {
    // Standard "fetch on mount" shape — same as the Transactions tab.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // Mount-only: `load` closes over `t` just for the error toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const inRange = useMemo(
    () => (sessions ?? []).filter((r) => inDateRange(r.page_view_at, dateRange)),
    [sessions, dateRange],
  )
  const visible = useMemo(
    () => (statusFilter === "all" ? inRange : inRange.filter((r) => r.effectiveStatus === statusFilter)),
    [inRange, statusFilter],
  )

  // Funnel over the date range (not the status filter — filtering to
  // "Completed" would otherwise read as a 100% conversion).
  const funnel = useMemo(() => {
    const views = inRange.length
    const initiated = inRange.filter((r) => r.initiate_checkout_at).length
    const completed = inRange.filter((r) => r.effectiveStatus === "completed").length
    const rate = views > 0 ? Math.round((completed / views) * 1000) / 10 : 0
    return { views, initiated, completed, rate }
  }, [inRange])

  async function handleDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/payments/checkout-sessions/${pendingDelete.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || t("deleteFailed"))
        return
      }
      const deletedId = pendingDelete.id
      setSessions((prev) => prev?.filter((s) => s.id !== deletedId) ?? prev)
      setPendingDelete(null)
      toast.success(t("deleteSuccess"))
    } catch {
      toast.error(t("deleteFailed"))
    } finally {
      setDeleting(false)
    }
  }

  const iconButton = buttonVariants({ variant: "ghost", size: "icon-xs" })
  const filtersActive = dateRange !== "all" || statusFilter !== "all"
  const filterTrigger = (active: boolean) =>
    cn(
      "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors hover:bg-muted",
      active
        ? "border-primary/40 bg-primary/10 text-primary"
        : "border-border text-muted-foreground hover:text-foreground",
    )

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

        <div className="flex flex-wrap items-center gap-3">
          {sessions !== null && sessions.length > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("count", { count: visible.length })}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger className={filterTrigger(statusFilter !== "all")}>
              <Filter className="size-3.5" />
              {statusFilter === "all" ? t("statusFilter.all") : t(`status.${statusFilter}`)}
              <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-border bg-popover">
              {(["all", ...STATUSES] as const).map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "text-sm",
                    statusFilter === s ? "text-primary" : "text-popover-foreground",
                  )}
                >
                  {s === "all" ? t("statusFilter.all") : t(`status.${s}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className={filterTrigger(dateRange !== "all")}>
              <Calendar className="size-3.5" />
              {tTransactions(`date.${dateRange}`)}
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
                  {tTransactions(`date.${range}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {sessions !== null && sessions.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FunnelStat label={t("funnel.views")} value={funnel.views} />
          <FunnelStat label={t("funnel.initiated")} value={funnel.initiated} />
          <FunnelStat label={t("funnel.completed")} value={funnel.completed} />
          <FunnelStat label={t("funnel.conversion")} value={`${funnel.rate}%`} accent />
        </div>
      )}

      {sessions === null ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <TrendingUp className="h-6 w-6" />
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            {sessions.length === 0 ? t("empty") : t("emptyFiltered")}
          </p>
          {sessions.length > 0 && filtersActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDateRange("all")
                setStatusFilter("all")
              }}
            >
              {t("clearFilter")}
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">{t("table.customer")}</TableHead>
                <TableHead className="text-muted-foreground">{t("table.product")}</TableHead>
                <TableHead className="text-muted-foreground">{t("table.pageView")}</TableHead>
                <TableHead className="text-muted-foreground">{t("table.initiated")}</TableHead>
                <TableHead className="text-muted-foreground">{t("table.status")}</TableHead>
                <TableHead className="text-muted-foreground">{t("table.lastActivity")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((s) => {
                const phone = contactPhone(s)
                const name = contactName(s)
                return (
                  <TableRow key={s.id} className="group border-border">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-foreground">{name ?? phone ?? t("anonymous")}</span>
                          {name && phone && (
                            <span className="text-xs tabular-nums text-muted-foreground">{phone}</span>
                          )}
                        </div>
                        {/* Row actions — same pattern as the Transactions log:
                            dimmed until the row is hovered/focused, but always
                            visible for touch screens. */}
                        <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  onClick={() => setPendingDelete(s)}
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
                          {s.conversation_id ? (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Link
                                    href={`/inbox?c=${s.conversation_id}`}
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
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {s.form?.product?.name ?? s.form?.name ?? s.slug_producto}
                    </TableCell>
                    <TableCell>
                      <StepIndicator at={s.page_view_at} notYet={t("notYet")} />
                    </TableCell>
                    <TableCell>
                      <StepIndicator at={s.initiate_checkout_at} notYet={t("notYet")} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE[s.effectiveStatus]}>
                        {t(`status.${s.effectiveStatus}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(s.last_activity_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                )
              })}
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
                  contact: contactName(pendingDelete) ?? contactPhone(pendingDelete) ?? t("anonymous"),
                  date: new Date(pendingDelete.page_view_at).toLocaleString(),
                })}
            </DialogDescription>
          </DialogHeader>
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

function FunnelStat({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  )
}
