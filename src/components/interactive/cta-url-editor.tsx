"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Loader2,
  Palette,
  Type,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { INTERACTIVE_LIMITS } from "@/lib/whatsapp/meta-api";
import {
  CTA_BUTTON_TEXT_MAX,
  CTA_COLOR_PRESETS,
  CTA_HEADER_IMAGE,
  isHexColor,
  isValidCtaUrl,
  validateCtaUrlConfig,
  type CtaHeaderMode,
  type CtaUrlMessageConfig,
} from "@/lib/whatsapp/cta-url";
import { uploadAccountMedia } from "@/lib/storage/upload-media";

// Header images (uploaded or generated) live in the public flow-media
// bucket so Meta can fetch them at send time — same bucket the Flows
// send_media node uses, account-scoped by uploadAccountMedia.
const CTA_MEDIA_BUCKET = "flow-media";

const RATIO = CTA_HEADER_IMAGE.width / CTA_HEADER_IMAGE.height;

/**
 * Render a flat PNG in `hex` at the recommended header size. WhatsApp
 * has no "background color" field, so the solid-color option is sent as
 * this image header.
 */
async function renderSolidColorPng(hex: string): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = CTA_HEADER_IMAGE.width;
  canvas.height = CTA_HEADER_IMAGE.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't generate the color header.");
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Couldn't generate the color header.");
  return new File([blob], `cta-color-${hex.slice(1).toLowerCase()}.png`, {
    type: "image/png",
  });
}

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new Error("Couldn't read that image."));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/** Human hint for an image that will be cropped or look soft. */
function sizeWarning(width: number, height: number): string | null {
  const ratio = width / height;
  if (width < CTA_HEADER_IMAGE.width / 2) {
    return `The image is ${width} × ${height} px — it may look blurry. Use ${CTA_HEADER_IMAGE.width} × ${CTA_HEADER_IMAGE.height} px.`;
  }
  if (Math.abs(ratio - RATIO) / RATIO > 0.1) {
    return `The image is ${width} × ${height} px (${ratio.toFixed(2)}:1). WhatsApp will crop it to ${CTA_HEADER_IMAGE.aspectLabel} — edges may be cut off.`;
  }
  return null;
}

interface CtaUrlEditorProps {
  value: Partial<CtaUrlMessageConfig>;
  onChange: (patch: Partial<CtaUrlMessageConfig>) => void;
  /** Show the live WhatsApp-style preview. Default true. */
  showPreview?: boolean;
}

/**
 * Controlled editor for a WhatsApp "Call to Action URL" message: body,
 * a centered link button (text + external URL), an optional header
 * (uploaded image or solid color) and an optional footer. Shared by the
 * Flows `send_cta_url` node form and the Automations `send_cta_url` step.
 */
export function CtaUrlEditor({ value, onChange, showPreview = true }: CtaUrlEditorProps) {
  const mode: CtaHeaderMode = value.header_mode ?? "none";
  const body = value.body ?? "";
  const buttonText = value.button_text ?? "";
  const url = value.url ?? "";
  const footer = value.footer ?? "";
  const headerText = value.header_text ?? "";
  const validation = validateCtaUrlConfig(value);
  const urlInvalid = url.trim().length > 0 && !isValidCtaUrl(url);

  return (
    <div className="@container">
      <div className="flex flex-col gap-4 @2xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <HeaderSection value={value} mode={mode} headerText={headerText} onChange={onChange} />

          <Field label="Message text" counter={`${body.length}/${INTERACTIVE_LIMITS.bodyMaxLength}`}>
            <Textarea
              value={body}
              maxLength={INTERACTIVE_LIMITS.bodyMaxLength}
              onChange={(e) => onChange({ body: e.target.value })}
              placeholder="e.g. Your order is ready — complete the payment securely here:"
              className="min-h-20 bg-muted text-foreground"
            />
          </Field>

          <div className="rounded-md border border-border p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Link2 className="h-3.5 w-3.5 text-primary" />
              Link button
            </p>
            <div className="flex flex-col gap-2">
              <Field label="Button text" counter={`${buttonText.length}/${CTA_BUTTON_TEXT_MAX}`}>
                <Input
                  value={buttonText}
                  maxLength={CTA_BUTTON_TEXT_MAX}
                  onChange={(e) => onChange({ button_text: e.target.value })}
                  placeholder="Pay now"
                  className="bg-muted text-center text-foreground"
                />
              </Field>
              <Field label="Destination URL">
                <Input
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => onChange({ url: e.target.value })}
                  onBlur={(e) => {
                    // Trim stray whitespace from pasted links.
                    const v = e.target.value.trim();
                    if (v !== e.target.value) onChange({ url: v });
                  }}
                  placeholder="https://shop.example.com/checkout"
                  aria-invalid={urlInvalid || undefined}
                  className={cn(
                    "bg-muted font-mono text-xs text-foreground",
                    urlInvalid && "border-destructive",
                  )}
                />
                <p
                  className={cn(
                    "mt-1 text-[11px]",
                    urlInvalid ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {urlInvalid
                    ? "Enter a full link starting with https://"
                    : "Opens in the customer's browser (payment page, store, …)."}
                </p>
              </Field>
            </div>
          </div>

          <Field label="Footer (optional)" counter={`${footer.length}/${INTERACTIVE_LIMITS.footerMaxLength}`}>
            <Input
              value={footer}
              maxLength={INTERACTIVE_LIMITS.footerMaxLength}
              onChange={(e) => onChange({ footer: e.target.value })}
              placeholder="Secure payment · 24h support"
              className="bg-muted text-foreground"
            />
          </Field>

          {!validation.ok && (
            <p className="text-xs text-amber-500">{validation.error}</p>
          )}
        </div>

        {showPreview && (
          <div className="flex shrink-0 flex-col items-center gap-2 @2xl:w-[280px]">
            <span className="text-xs font-medium text-muted-foreground">Preview</span>
            <CtaUrlPreview value={value} />
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Header: none / image / solid color
// ------------------------------------------------------------

function HeaderSection({
  value,
  mode,
  headerText,
  onChange,
}: {
  value: Partial<CtaUrlMessageConfig>;
  mode: CtaHeaderMode;
  headerText: string;
  onChange: (patch: Partial<CtaUrlMessageConfig>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const currentColor = isHexColor(value.header_color) ? value.header_color : CTA_COLOR_PRESETS[0];
  // Draft for the free color picker — it fires on every drag step, so
  // we only generate + upload once the user settles on a color.
  const [draftColor, setDraftColor] = useState<string | null>(null);

  const applyColor = useCallback(
    async (hex: string) => {
      setBusy(true);
      try {
        const file = await renderSolidColorPng(hex);
        const { publicUrl } = await uploadAccountMedia(CTA_MEDIA_BUCKET, file);
        onChange({ header_mode: "color", header_color: hex, header_image_url: publicUrl });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save the color header.");
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  useEffect(() => {
    if (!draftColor || draftColor.toLowerCase() === currentColor.toLowerCase()) return;
    const handle = setTimeout(() => {
      void applyColor(draftColor);
      setDraftColor(null);
    }, 600);
    return () => clearTimeout(handle);
  }, [draftColor, currentColor, applyColor]);

  const switchMode = (next: CtaHeaderMode) => {
    if (next === mode) return;
    setWarning(null);
    if (next === "color") {
      // Generate the image for the current/default swatch right away so
      // the config is sendable without an extra click.
      onChange({ header_mode: "color", header_image_url: "" });
      void applyColor(currentColor);
      return;
    }
    onChange({ header_mode: next, header_image_url: "" });
  };

  const handleFile = async (file: File) => {
    if (!CTA_HEADER_IMAGE.accept.split(",").includes(file.type)) {
      toast.error("Use a JPG or PNG image.");
      return;
    }
    if (file.size > CTA_HEADER_IMAGE.maxBytes) {
      toast.error(
        `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB — WhatsApp's limit is 5 MB.`,
      );
      return;
    }
    setBusy(true);
    try {
      const { width, height } = await readImageSize(file);
      setWarning(sizeWarning(width, height));
      const { publicUrl } = await uploadAccountMedia(CTA_MEDIA_BUCKET, file);
      onChange({ header_mode: "image", header_image_url: publicUrl });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Header</span>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted p-0.5">
        <ModeButton active={mode === "none"} onClick={() => switchMode("none")} icon={<Type className="h-3.5 w-3.5" />} label="Text only" />
        <ModeButton active={mode === "image"} onClick={() => switchMode("image")} icon={<ImageIcon className="h-3.5 w-3.5" />} label="Image" />
        <ModeButton active={mode === "color"} onClick={() => switchMode("color")} icon={<Palette className="h-3.5 w-3.5" />} label="Solid color" />
      </div>

      {mode === "none" && (
        <Field
          label="Header text (optional)"
          counter={`${headerText.length}/${INTERACTIVE_LIMITS.headerTextMaxLength}`}
        >
          <Input
            value={headerText}
            maxLength={INTERACTIVE_LIMITS.headerTextMaxLength}
            onChange={(e) => onChange({ header_text: e.target.value })}
            placeholder="Bold line above the message"
            className="bg-muted text-foreground"
          />
        </Field>
      )}

      {mode === "image" && (
        <div className="flex flex-col gap-1.5">
          {value.header_image_url ? (
            <div className="relative overflow-hidden rounded-md border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded public URL, shown cropped exactly like WhatsApp */}
              <img
                src={value.header_image_url}
                alt="Header"
                className="block w-full object-cover"
                style={{ aspectRatio: `${CTA_HEADER_IMAGE.width} / ${CTA_HEADER_IMAGE.height}` }}
              />
              <button
                type="button"
                onClick={() => {
                  setWarning(null);
                  onChange({ header_image_url: "" });
                }}
                disabled={busy}
                className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                aria-label="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-card px-3 py-5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              style={{ aspectRatio: `${CTA_HEADER_IMAGE.width} / ${CTA_HEADER_IMAGE.height}` }}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Click to upload an image
                </>
              )}
            </button>
          )}
          <p className="text-[11px] leading-snug text-muted-foreground">
            Recommended size: <strong className="text-foreground">{CTA_HEADER_IMAGE.width} × {CTA_HEADER_IMAGE.height} px</strong>{" "}
            ({CTA_HEADER_IMAGE.aspectLabel} landscape) · JPG or PNG · max 5 MB. Other proportions get cropped by WhatsApp.
          </p>
          {warning && (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-500">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {warning}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={CTA_HEADER_IMAGE.accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {mode === "color" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {CTA_COLOR_PRESETS.map((hex) => {
              const selected = hex.toLowerCase() === currentColor.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  disabled={busy}
                  onClick={() => !selected && void applyColor(hex)}
                  className={cn(
                    "h-7 w-7 rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110 disabled:cursor-wait",
                    selected ? "ring-2 ring-primary" : "ring-1 ring-border",
                  )}
                  style={{ background: hex }}
                  aria-label={`Background ${hex}`}
                  aria-pressed={selected}
                />
              );
            })}
            <label
              className="relative flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-muted pr-2.5 pl-1 text-[11px] text-muted-foreground hover:text-foreground"
              title="Custom color"
            >
              <input
                type="color"
                value={draftColor ?? currentColor}
                disabled={busy}
                onChange={(e) => setDraftColor(e.target.value)}
                className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
              Custom
            </label>
            {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Sent as a clean {CTA_HEADER_IMAGE.width} × {CTA_HEADER_IMAGE.height} px banner in{" "}
            <span className="font-mono text-foreground">{(draftColor ?? currentColor).toUpperCase()}</span> — no image needed.
          </p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// WhatsApp-style preview
// ------------------------------------------------------------

/**
 * Read-only render of a CTA URL message as it appears on the phone:
 * header (image / color banner / bold text), body, footer, then the
 * full-width link button with its label centered.
 */
export function CtaUrlPreview({
  value,
  className,
}: {
  value: Partial<CtaUrlMessageConfig>;
  className?: string;
}) {
  const mode = value.header_mode ?? "none";
  const showColor = mode === "color" && isHexColor(value.header_color);
  const showImage = mode === "image" && !!value.header_image_url;
  return (
    <div
      className={cn(
        "w-full max-w-[260px] overflow-hidden rounded-lg bg-card text-foreground shadow-sm ring-1 ring-border",
        className,
      )}
    >
      {showColor || showImage || mode === "image" ? (
        <div className="p-1 pb-0">
          <div
            className="flex w-full items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground"
            style={{
              aspectRatio: `${CTA_HEADER_IMAGE.width} / ${CTA_HEADER_IMAGE.height}`,
              background: showColor ? value.header_color : undefined,
            }}
          >
            {showImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview of a user-uploaded public URL
              <img src={value.header_image_url} alt="" className="h-full w-full object-cover" />
            ) : !showColor ? (
              <ImageIcon className="h-6 w-6 opacity-50" />
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="px-3 py-2">
        {mode === "none" && value.header_text ? (
          <p className="mb-1 break-words text-sm font-semibold">{value.header_text}</p>
        ) : null}
        <p className="whitespace-pre-wrap break-words text-sm">
          {value.body || <span className="text-muted-foreground">Message text…</span>}
        </p>
        {value.footer ? (
          <p className="mt-1 break-words text-[11px] text-muted-foreground">{value.footer}</p>
        ) : null}
      </div>
      <div className="flex w-full items-center justify-center gap-1.5 border-t border-border px-3 py-2.5 text-center text-sm font-medium text-primary">
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{value.button_text || "Button"}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Small building blocks
// ------------------------------------------------------------

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function Field({
  label,
  counter,
  children,
}: {
  label: string;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">{label}</label>
        {counter ? (
          <span className="text-[10px] tabular-nums text-muted-foreground">{counter}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
