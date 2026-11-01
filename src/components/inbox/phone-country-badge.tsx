"use client";

import { useMemo, useState } from "react";
import { getPhoneCountry } from "@/lib/whatsapp/phone-country";
import { cn } from "@/lib/utils";

/**
 * Small "🇨🇴 Colombia" chip derived from the contact's calling code.
 * Uses flagcdn PNGs instead of emoji flags because Windows doesn't render
 * regional-indicator emoji (it shows "CO" letters instead of a flag).
 */
export function PhoneCountryBadge({ phone, className }: { phone: string | null | undefined; className?: string }) {
  const country = useMemo(() => getPhoneCountry(phone), [phone]);
  const [imgFailed, setImgFailed] = useState(false);
  if (!country) return null;
  const code = country.iso.toLowerCase();

  return (
    <span
      title={`${country.name} (+${country.dialCode})`}
      className={cn(
        "inline-flex max-w-[14rem] shrink-0 items-center gap-1.5 rounded-full border border-border bg-background/90 px-2.5 py-1 text-[11px] font-medium leading-4 text-foreground shadow-sm backdrop-blur",
        className
      )}
    >
      {imgFailed ? (
        <span className="text-[9px] font-semibold text-muted-foreground">{country.iso}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://flagcdn.com/w40/${code}.png`}
          alt=""
          width={16}
          height={12}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="h-3 w-4 shrink-0 rounded-[2px] object-cover shadow-[0_0_0_0.5px_rgba(0,0,0,0.25)]"
        />
      )}
      <span className="truncate">{country.name}</span>
      <span className="text-muted-foreground">+{country.dialCode}</span>
    </span>
  );
}
