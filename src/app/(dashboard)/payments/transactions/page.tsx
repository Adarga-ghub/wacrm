"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react"

import type { PaymentTransaction, PaymentTransactionStatus } from "@/types"
import { usePaymentsT } from "@/hooks/use-payments-locale"
import { BackLink } from "@/components/layout/back-link"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STATUS_BADGE: Record<PaymentTransactionStatus, string> = {
  created: "border-slate-500/30 bg-slate-500/10 text-muted-foreground",
  approved: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  refunded: "border-amber-500/30 bg-amber-500/10 text-amber-300",
}

export default function PaymentTransactionsPage() {
  const t = usePaymentsT("list")
  const [transactions, setTransactions] = useState<PaymentTransaction[] | null>(null)

  async function load() {
    const res = await fetch("/api/payments/transactions")
    if (!res.ok) {
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
  }, [])

  return (
    <div className="space-y-6">
      <BackLink
        href="/payments"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </BackLink>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every payment your checkout forms have recorded.
        </p>
      </div>

      {transactions === null ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CreditCard className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Form</TableHead>
                <TableHead className="text-muted-foreground">Contact</TableHead>
                <TableHead className="text-right text-muted-foreground">Amount</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Automation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((txn) => (
                <TableRow key={txn.id} className="border-border">
                  <TableCell className="text-muted-foreground">
                    {new Date(txn.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-foreground">{txn.form?.name ?? "—"}</TableCell>
                  <TableCell className="text-foreground">
                    {txn.contact?.name || txn.whatsapp_phone || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    {txn.amount} {txn.currency}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE[txn.status]}>
                      {txn.status}
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
                        Sent
                      </Badge>
                    ) : txn.send_automation ? (
                      <span className="text-muted-foreground">Pending</span>
                    ) : (
                      <Badge variant="outline">Off</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
