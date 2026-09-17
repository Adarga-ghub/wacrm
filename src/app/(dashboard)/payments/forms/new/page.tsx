"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function NewPaymentFormPage() {
  const router = useRouter()
  const t = useTranslations("Payments.new")
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    const res = await fetch("/api/payments/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || t("createFailed"))
      setCreating(false)
      return
    }
    router.push(`/payments/forms/${data.form.id}/edit`)
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-muted-foreground">{t("nameLabel")}</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push("/payments")}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("create")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
