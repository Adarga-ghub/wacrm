import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export interface ReceiptData {
  businessName: string
  receiptNumber: string
  date: Date
  itemDescription: string
  amount: number
  currency: string
  buyerName: string
  buyerEmail: string | null
  buyerPhone: string | null
}

const PAGE_WIDTH = 595.28 // A4 @ 72dpi
const PAGE_HEIGHT = 841.89

/**
 * Renders a branded payment receipt as a PDF buffer. This is
 * explicitly NOT a fiscally-compliant invoice (no tax ID, no
 * government e-invoicing integration — those are jurisdiction-
 * specific and require a certified provider, e.g. a PAC for Mexican
 * CFDI) — the disclaimer at the bottom says so on the document
 * itself, not just in our own docs, so a customer who needs a real
 * tax invoice knows to ask the merchant directly rather than assume
 * this satisfies that.
 */
export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const margin = 56
  let y = PAGE_HEIGHT - margin
  const ink = rgb(0.11, 0.11, 0.13)
  const muted = rgb(0.45, 0.45, 0.48)
  const accent = rgb(0.09, 0.55, 0.35)

  const draw = (
    text: string,
    opts: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb>; x?: number } = {},
  ) => {
    page.drawText(text, {
      x: opts.x ?? margin,
      y,
      size: opts.size ?? 11,
      font: opts.f ?? font,
      color: opts.color ?? ink,
    })
  }

  draw(data.businessName, { size: 20, f: bold })
  y -= 22
  draw('Payment Receipt', { size: 12, color: accent, f: bold })
  y -= 34

  draw(`Receipt #${data.receiptNumber}`, { size: 10, color: muted })
  y -= 14
  draw(
    data.date.toLocaleString('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    }),
    { size: 10, color: muted },
  )
  y -= 34

  page.drawLine({
    start: { x: margin, y },
    end: { x: PAGE_WIDTH - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.87),
  })
  y -= 24

  draw('Billed to', { size: 10, color: muted, f: bold })
  y -= 16
  draw(data.buyerName || '—', { size: 11 })
  y -= 15
  if (data.buyerEmail) {
    draw(data.buyerEmail, { size: 10, color: muted })
    y -= 14
  }
  if (data.buyerPhone) {
    draw(data.buyerPhone, { size: 10, color: muted })
    y -= 14
  }
  y -= 20

  // Line-item table.
  const tableTop = y
  draw('Description', { size: 10, color: muted, f: bold })
  draw('Amount', { size: 10, color: muted, f: bold, x: PAGE_WIDTH - margin - 100 })
  y -= 8
  page.drawLine({
    start: { x: margin, y },
    end: { x: PAGE_WIDTH - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.87),
  })
  y -= 22
  draw(data.itemDescription, { size: 11 })
  draw(`${data.amount.toFixed(2)} ${data.currency}`, {
    size: 11,
    x: PAGE_WIDTH - margin - 100,
  })
  y -= 16
  page.drawLine({
    start: { x: margin, y },
    end: { x: PAGE_WIDTH - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.87),
  })
  y -= 24

  draw('Total', { size: 13, f: bold, x: PAGE_WIDTH - margin - 190 })
  draw(`${data.amount.toFixed(2)} ${data.currency}`, {
    size: 13,
    f: bold,
    color: accent,
    x: PAGE_WIDTH - margin - 100,
  })
  void tableTop

  const footerY = margin + 20
  page.drawText(
    'This receipt confirms your payment. It is not a fiscal invoice / tax document issued by any government authority.',
    { x: margin, y: footerY, size: 8, font, color: muted, maxWidth: PAGE_WIDTH - margin * 2 },
  )

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
