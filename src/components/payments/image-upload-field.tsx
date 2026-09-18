"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2, Upload, X } from "lucide-react"

import { uploadAccountMedia, MEDIA_MAX_BYTES_BY_KIND } from "@/lib/storage/upload-media"
import type { PaymentsT } from "@/hooks/use-payments-locale"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])

/** Reads a File's pixel dimensions client-side — no upload needed just to measure it. */
function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(objectUrl)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("invalid-image"))
    }
    img.src = objectUrl
  })
}

/**
 * File-upload replacement for the Payment Skins editor's old plain
 * URL text inputs (logo, background image, banner, product image).
 * Recommended dimensions are shown BEFORE picking a file, and are
 * enforced as a hard ceiling: an image wider or taller than
 * `maxWidth`/`maxHeight` is rejected client-side (measured from the
 * `File` via `Image.onload`, no upload attempt) rather than silently
 * resized or accepted — a merchant who uploads a 4000px photo for a
 * 200×200 logo slot gets a clear error, not a slow page.
 *
 * Uploads go straight to Supabase Storage via `uploadAccountMedia`
 * (`src/lib/storage/upload-media.ts`) — the same account-scoped
 * client-side path every other media upload in this app already
 * uses (chat attachments, flow media), just pointed at the
 * `payment-media` bucket (migration 055).
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  maxWidth,
  maxHeight,
  t,
}: {
  label: string
  /** Current image URL, or "" for none. */
  value: string
  onChange: (url: string) => void
  maxWidth: number
  maxHeight: number
  t: PaymentsT
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // reset so the same file can be re-picked after an error
    if (!file) return

    if (!ALLOWED_MIME.has(file.type)) {
      toast.error(t("imageInvalidType"))
      return
    }
    if (file.size > MEDIA_MAX_BYTES_BY_KIND.image) {
      toast.error(t("imageTooLarge"))
      return
    }

    let dimensions: { width: number; height: number }
    try {
      dimensions = await readImageDimensions(file)
    } catch {
      toast.error(t("imageInvalidType"))
      return
    }
    if (dimensions.width > maxWidth || dimensions.height > maxHeight) {
      toast.error(t("imageDimensionsExceeded", { width: maxWidth, height: maxHeight }))
      return
    }

    setUploading(true)
    try {
      const { publicUrl } = await uploadAccountMedia("payment-media", file)
      onChange(publicUrl)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("imageUploadFailed"))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="grid gap-2">
      <Label className="text-muted-foreground">{label}</Label>
      <p className="text-xs text-muted-foreground">
        {t("recommendedSize", { width: maxWidth, height: maxHeight })}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onPick}
      />
      <div className="flex items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? t("uploadingImage") : value ? t("changeImage") : t("uploadImage")}
          </Button>
          {value && !uploading && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <X className="h-4 w-4" />
              {t("removeImage")}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
