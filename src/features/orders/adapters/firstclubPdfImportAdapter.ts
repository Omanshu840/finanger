import type { UnifiedOrder, OrderItem } from "../types";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return "str" in item;
}

// ── PDF Text Extraction ───────────────────────────────────────────────────────
//
// Uses pdfjs-dist with a CDN-hosted worker to avoid Vite's node_modules
// serving issues. Returns a single flat string of all text tokens joined
// by spaces — we intentionally flatten everything since token positions
// are inconsistent across PDF renderers.

export async function extractTextFromFirstClubPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const pageTokens = content.items
      .filter(isTextItem)
      .filter((item) => !!item.str.trim())
      .map((item) => item.str.trim());

    pageTexts.push(pageTokens.join(" "));
  }

  return pageTexts.join(" ");
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
  const match = raw.match(/(\d{2})-([A-Za-z]{3})-(\d{4})/i);
  if (!match) return new Date();
  const [, day, monthStr, year] = match;
  return new Date(Number(year), months[monthStr.toLowerCase()], Number(day), 12, 0, 0);
}

// ── Main Parser ───────────────────────────────────────────────────────────────
//
// Trolleypop/FirstClub invoices emit tokens collapsed into one long string.
// Depending on the PDF renderer, rows may appear as:
//
//   FORM A (spaced, single-line per item):
//     "1 Button Mushroom x 2 158.00 20.25% 126.00 0.00% 0.00 ... 126.00"
//
//   FORM B (collapsed, no spaces between serial+name or qty+price):
//     "1Robusta Banana Ripe x 135.0020.00%28.00 0.00% ... 28.00"
//
//   FORM C (multiline item name, split across tokens):
//     "3 Chutnefy Coriander Chutney" ... "x 1" ... "125.00 14.40% ..."
//
// Strategy: flatten everything to one string, then use a global regex that:
//   - anchors on a row serial number (\d+)
//   - captures item name (non-greedy up to "x <qty>")
//   - captures qty
//   - captures 6 pairs of (number, percent|number) for the tax columns
//   - captures the final row total
//
// This handles all three forms above.

export function parseFirstClubInvoiceText(
  rawText: string
): UnifiedOrder {
  const flat = rawText
    .replace(/\u00a0/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // ── Metadata ──────────────────────────────────────────────────────────────
  const orderNoMatch = flat.match(/Order\s*No[:\s]*([A-Z0-9]+)/i);
  const dateMatch = flat.match(/Date[:\s]*(\d{2}-[A-Za-z]{3}-\d{4})/i);

  const orderId = orderNoMatch
    ? `firstclub-${orderNoMatch[1]}`
    : `firstclub-${Date.now()}`;

  const placedAt = dateMatch ? parseInvoiceDate(dateMatch[1]) : new Date();

  // ── Slice to just the items section ───────────────────────────────────────
  //
  // Every FirstClub invoice has:
  //   "...Rate Amt. Rate Amt. Rate Amt. 1 First Item x 1 ..."
  //                                    ↑ items start here
  //   "...Total <number> Item Total..."
  //              ↑ items end here
  //
  // We slice the flat string to only the region between these two markers
  // so the regex never touches the address block or footer.

  const ITEMS_START_MARKER = /Rate\s+Amt\.\s+Rate\s+Amt\.\s+Rate\s+Amt\./i;
  const ITEMS_END_MARKER = /\bTotal\s+[\d,.]+\s+[\d,.]+\s+[\d,.]+\s+[\d,.]+\s+[\d,.]+\s+Item\s+Total/i;

  const startMatch = ITEMS_START_MARKER.exec(flat);
  if (!startMatch) {
    console.error("[FC Parser] Could not find items table start marker. Flat:\n", flat);
    throw new Error("No items found — make sure this is a FirstClub invoice PDF");
  }

  const itemsRegionRaw = flat.slice(startMatch.index + startMatch[0].length);

  // Cut off at the footer "Total" row
  const endMatch = ITEMS_END_MARKER.exec(itemsRegionRaw);
  const itemsRegion = endMatch
    ? itemsRegionRaw.slice(0, endMatch.index)
    : itemsRegionRaw;

  console.log("[FC Parser] Items region:\n", itemsRegion);

  // ── Items ─────────────────────────────────────────────────────────────────
  const itemRegex =
    /\b(\d+)\s+([A-Za-z0-9''&(),.\-/\s]+?)\s+x\s*(\d+)\s*([\d.]+)\s*([\d.]+%?)\s*([\d.]+)\s*([\d.]+%?)\s*([\d.]+)\s*([\d.]+%?)\s*([\d.]+)\s*([\d.]+%?)\s*([\d.]+)\s*([\d.]+)/g;

  const items: OrderItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(itemsRegion)) !== null) {
    const [, , rawName, qty, , , taxableAmt, , , , , , , rowTotal] = match;

    const name = rawName.replace(/\s+/g, " ").trim();
    if (!name || /^\d+$/.test(name)) continue;

    items.push({
      name,
      quantity: parseInt(qty, 10),
      price: parseAmount(rowTotal || taxableAmt),
    });
  }

  // ── Bill Summary ──────────────────────────────────────────────────────────
  const extract = (pattern: RegExp) => {
    const m = flat.match(pattern);
    return m ? parseAmount(m[1]) : 0;
  };

  const itemTotal = extract(/Item\s*Total\s*([\d.]+)/i);
  const deliveryCharge = extract(
    /Delivery\s*Charges?(?:\s*\(?Inclusive\s*of\s*Taxes\)?)?\s*([\d.]+)/i
  );
  const handlingFee = extract(/Handling\s*Fee\s*([\d.]+)/i);
  const couponDiscount = extract(/Coupon\s*Discount\s*([\d.]+)/i);
  const totalAmount =
    extract(/Invoice\s*value\s*([\d.]+)/i) ||
    itemTotal + deliveryCharge + handlingFee - couponDiscount;

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!items.length) {
    console.error("[FC Parser] No items parsed. Items region:\n", itemsRegion);
    throw new Error("No items found — make sure this is a FirstClub invoice PDF");
  }

  console.log(`[FC Parser] Parsed ${items.length} items, total ₹${totalAmount}`);

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