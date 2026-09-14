"use client";

import { Megaphone, ExternalLink, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { AdReferral } from "@/types";

/**
 * Inline "system card" shown above the message that carried a
 * Click-to-WhatsApp ad referral (migration 042) — mirrors how the
 * WhatsApp Business mobile app surfaces the originating ad right in
 * the chat, rather than as a persistent header banner. Renders once,
 * on whichever message(s) actually have `referral` set; a contact who
 * clicked more than one ad over time gets one card per click, in
 * place, so the history reads naturally top-to-bottom.
 */
export function AdReferralCard({ referral }: { referral: AdReferral }) {
  const t = useTranslations("Inbox.adReferral");
  const tActions = useTranslations("Inbox.actions");
  const thumb = referral.thumbnail_url || referral.image_url;
  const sourceLabel =
    referral.source_type === "post" ? t("sourceTypePost") : t("sourceTypeAd");
  // `source_id` is the ad's numeric id when source_type is "ad" — a
  // boosted post's id otherwise. Label follows which one it actually is
  // rather than always saying "Ad ID", so it never mislabels a post.
  const idLabel = referral.source_type === "post" ? t("postId") : t("adId");

  const handleCopyId = async () => {
    if (!referral.source_id) return;
    try {
      await navigator.clipboard.writeText(referral.source_id);
      toast.success(tActions("copied"));
    } catch {
      toast.error(tActions("copyFailed"));
    }
  };

  return (
    <div className="mx-auto mb-2 max-w-sm rounded-lg border border-border bg-muted/50 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Megaphone className="h-3.5 w-3.5" />
        <span>{t("startedFromAd")}</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
          {sourceLabel}
        </span>
      </div>
      <div className="flex gap-3">
        {thumb && (
          // Ad creative thumbnail Meta hands back on the referral —
          // an arbitrary remote host, so a plain <img> (not next/image)
          // avoids fighting the image-optimizer's domain allowlist for
          // a one-off preview.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="h-14 w-14 flex-shrink-0 rounded-md object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          {referral.headline && (
            <p className="truncate text-sm font-semibold text-foreground">
              {referral.headline}
            </p>
          )}
          {referral.body && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {referral.body}
            </p>
          )}
          {referral.source_id && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="truncate">
                {idLabel}: <span className="font-mono text-foreground">{referral.source_id}</span>
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                className="flex-shrink-0 rounded p-0.5 hover:bg-muted hover:text-foreground"
                aria-label={tActions("copyText")}
                title={tActions("copyText")}
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          )}
          {referral.source_url && (
            <a
              href={referral.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {t("viewAd")}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
