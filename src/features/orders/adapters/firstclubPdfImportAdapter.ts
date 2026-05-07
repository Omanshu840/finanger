import type { UnifiedOrder, OrderItem } from "../types";

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    useSystemFonts: true,
  }).promise;

  const allTokens: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if ("str" in item && item.str.trim()) {
        allTokens.push(item.str.trim());
      }
    }
  }

  return allTokens.join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, "").trim()) || 0;
}

function parseInvoiceDate(raw: string): Date {
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const match = raw.trim().match(/(\d{2})-([A-Za-z]{3})-(\d{4})/);
  if (!match) return new Date();
  const [, day, monthStr, year] = match;
  return new Date(Number(year), months[monthStr.toLowerCase()], Number(day), 12, 0, 0);
}

const isNumeric = (s: string) => /^[\d,]+\.?\d*$/.test(s.trim());
const isPercent = (s: string) => /^[\d.]+%$/.test(s.trim());
const isNumericOrPercent = (s: string) => isNumeric(s) || isPercent(s);

// ── Main parser ───────────────────────────────────────────────────────────────
//
// Actual token stream (from logs) for each item row:
//
//   "1"  |  "Button Mushroom x 2"  |  "158.00"  |  "20.25%"  |  "126.00"
//   |  "0.00%"  |  "0.00"  |  "0.00%"  |  "0.00"  |  "0.00%"  |  "0.00"  |  "126.00"
//
// Pattern per item:
//   token[i]   = row number "1", "2", ...
//   token[i+1] = "Item Name x Qty"   ← the key: contains " x " surrounded by spaces
//   token[i+2] = gross value          e.g. "158.00"
//   token[i+3] = disc %               e.g. "20.25%"
//   token[i+4] = taxable amt          e.g. "126.00"
//   token[i+5..i+10] = tax columns    all "0.00%" / "0.00"
//   token[i+11] = row total           e.g. "126.00"  ← this is what we want

export function parseFirstClubInvoiceText(
  rawText: string,
): UnifiedOrder {
  const tokens = rawText
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  // ── Metadata ──────────────────────────────────────────────────────────────
  let orderId = `firstclub-${Date.now()}`;
  let placedAt = new Date();

  for (const token of tokens) {
    const orderNoMatch = token.match(/Order\s*No[:\s]+([A-Z0-9]+)/i);
    if (orderNoMatch) orderId = `firstclub-${orderNoMatch[1]}`;

    const dateMatch = token.match(/Date\s*[:\s]+(\d{2}-[A-Za-z]{3}-\d{4})/i);
    if (dateMatch) placedAt = parseInvoiceDate(dateMatch[1]);
  }

  // ── Items ──────────────────────────────────────────────────────────────────
  //
  // Scan for tokens matching "Anything x <number>" — these are item name tokens.
  // The serial number token immediately precedes it, so we anchor on the name token
  // directly and collect the next 10 numeric/percent tokens after it.
  //
  // Token layout after the name token:
  //   +0: gross value       "158.00"
  //   +1: disc %            "20.25%"
  //   +2: taxable amt       "126.00"   ← discounted price per unit
  //   +3: CGST rate %       "0.00%"
  //   +4: CGST amt          "0.00"
  //   +5: SGST rate %       "0.00%"
  //   +6: SGST amt          "0.00"
  //   +7: CESS rate %       "0.00%"
  //   +8: CESS amt          "0.00"
  //   +9: row total         "126.00"   ← final charged amount for the row

  const ITEM_TOKEN_REGEX = /^(.+?)\s+x\s+(\d+)$/i;

  const items: OrderItem[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const match = tokens[i].match(ITEM_TOKEN_REGEX);
    if (!match) continue;

    const [, name, qtyStr] = match;
    const qty = parseInt(qtyStr, 10);

    // Collect next 10 numeric/percent tokens
    const dataTokens: string[] = [];
    let j = i + 1;
    while (j < tokens.length && dataTokens.length < 10) {
      if (isNumericOrPercent(tokens[j])) {
        dataTokens.push(tokens[j]);
      } else {
        // Non-numeric token means we've hit the next row's serial number or
        // a label — stop collecting
        break;
      }
      j++;
    }

    // We need at least the row total (index 9 = 10th token)
    // If taxes are all 0, we may get fewer tokens — fall back to taxable amt (index 2)
    let price: number;
    if (dataTokens.length >= 10) {
      price = parseAmount(dataTokens[9]); // row total
    } else if (dataTokens.length >= 3) {
      price = parseAmount(dataTokens[2]); // taxable amt fallback
    } else if (dataTokens.length >= 1) {
      price = parseAmount(dataTokens[0]); // gross value last resort
    } else {
      price = 0;
    }

    items.push({ name: name.trim(), quantity: qty, price });
  }

  // ── Bill summary ──────────────────────────────────────────────────────────
  //
  // Token stream for bill section:
  //   "Item Total" | "430.00" | "Delivery Charges(Inclusive of Taxes)" | "0.00"
  //   | "Handling Fee" | "12.00" | "Referral Coupon" | "0.00"
  //   | "Coupon Discount" | "0.00" | "Invoice value" | "442.00"

  let itemTotal = 0;
  let deliveryCharge = 0;
  let handlingFee = 0;
  let couponDiscount = 0;
  let totalAmount = 0;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1] ?? "";

    if (/^Item\s*Total$/i.test(t) && isNumeric(next)) {
      itemTotal = parseAmount(next);
    }
    if (/^Delivery\s*Charges?/i.test(t) && isNumeric(next)) {
      deliveryCharge = parseAmount(next);
    }
    if (/^Handling\s*Fee$/i.test(t) && isNumeric(next)) {
      handlingFee = parseAmount(next);
    }
    if (/^Coupon\s*Discount$/i.test(t) && isNumeric(next)) {
      couponDiscount = parseAmount(next);
    }
    if (/^Invoice\s*value$/i.test(t) && isNumeric(next)) {
      totalAmount = parseAmount(next);
    }
  }

  if (!totalAmount) {
    totalAmount = itemTotal + deliveryCharge + handlingFee - couponDiscount;
  }

  return {
    id: orderId,
    source: "firstclub",
    placedAt,
    totalAmount,
    currency: "INR",
    status: "Imported manually",
    deliveryLabel: "FirstClub PDF import",
    items,
    rawData: [
      { label: "Item total", amount: itemTotal, isTotal: false },
      { label: "Delivery charges", amount: deliveryCharge, isTotal: false },
      { label: "Handling charge", amount: handlingFee, isTotal: false },
      { label: "Product discount", amount: -couponDiscount, isTotal: false },
      { label: "Bill total", amount: totalAmount, isTotal: true },
    ],
    isManual: true,
    manualImportType: "firstclub-pdf",
  };
}