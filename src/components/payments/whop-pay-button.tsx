"use client"

import { Loader2 } from "lucide-react"

import { WHOP_BUTTON_FONTS, type WhopButtonStyle } from "@/lib/payments/whop-button-style"

function MoneyBagIcon({ size, coinFill }: { size: number; coinFill: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={(size * 30) / 36}
      viewBox="0 0 36 30"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M9.5 2c1.5 1 3 1 4 0s3-1 4 0 2.5 1 4 0L19 7h-7z" />
      <path d="M12 7h7c4 3 7 7.500 7 12.500 0 5-4 8.500-11 8.500S3 24.500 3 19.500C3 14.500 7.500 10 12 7z" />
      <path d="M17.500 15.500c-.6-1-1.500-1.500-2.700-1.500-1.500 0-2.600.8-2.600 2s1.100 1.700 2.600 2.100 2.800 1 2.800 2.200-1.200 2.100-2.800 2.100c-1.300 0-2.300-.5-2.900-1.600M14.900 12.500v1.500M14.900 23.400v1.500" />
      <g fill={coinFill}>
        <path d="M23 21.500v5c0 1.100 2.200 2 5 2s5-.9 5-2v-5z" />
        <path d="M23 16.500v5c0 1.100 2.200 2 5 2s5-.9 5-2v-5z" />
        <ellipse cx="28" cy="16.500" rx="5" ry="2" />
      </g>
    </svg>
  )
}

function MenuLinesIcon({ size }: { size: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={(size * 20) / 26}
      viewBox="0 0 26 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="shrink-0"
    >
      <path d="M2 3h22M2 10h22M2 17h22" />
    </svg>
  )
}

/** The Whop pay button, drawn from the merchant's saved design. Also the live preview in the settings. */
export function WhopPayButton({
  buttonStyle,
  label,
  loading = false,
  onClick,
}: {
  buttonStyle: WhopButtonStyle
  label: string
  loading?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] px-3 py-1 font-bold shadow-[0_3px_8px_rgba(0,0,0,0.18)] transition-[filter] hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
      style={{
        backgroundColor: buttonStyle.backgroundColor,
        color: buttonStyle.textColor,
        borderColor: buttonStyle.borderColor,
        borderWidth: buttonStyle.borderWidth,
        borderStyle: "solid",
        fontSize: buttonStyle.fontSize,
        fontFamily: WHOP_BUTTON_FONTS[buttonStyle.fontFamily].css,
      }}
    >
      {loading ? (
        <Loader2 className="shrink-0 animate-spin" style={{ width: buttonStyle.iconSize, height: buttonStyle.iconSize }} />
      ) : (
        <MoneyBagIcon size={buttonStyle.iconSize} coinFill={buttonStyle.backgroundColor} />
      )}
      {label}
      <MenuLinesIcon size={buttonStyle.menuSize} />
    </button>
  )
}
