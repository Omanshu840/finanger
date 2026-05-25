import type { UnifiedOrder, OrderItem } from "../types";

export function sanitizePastedText(raw: string): string {
  // Step 1: Basic unicode normalization
  let text = raw
    .replace(/[\u00a0\u202f\u2007\u2008\u2009\u200a\u3000]/g, " ")
    .replace(/[\u200b-\u200f\u2028\u2029\u2060\ufeff\u00ad]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-");

  // Step 2: Whitelist — keep only parser-relevant characters
  text = text.replace(/[^\p{L}\p{N}₹#.,\-():\/'"@\n ]/gu, "");

  // Step 3: Normalize lines
  let lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Step 4: Remove ASIN codes (standalone uppercase alphanumeric 8-10 chars, e.g. B07BG62MBV)
  lines = lines.filter((l) => !/^[A-Z0-9]{8,12}$/.test(l));

  // Step 5: Merge split weight+unit lines into one meta line
  // Detects pattern: "250 g" / "." / "2 units"  →  "250 g. 2 units"
  // Also handles:    "1 kg"  / "." / "1 unit"   →  "1 kg. 1 unit"
  // Also handles:    "Approx. (180-200 g)" / "." / "1 unit" → "Approx. (180-200 g). 1 unit"
  const merged: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const curr = lines[i];
    const next = lines[i + 1];
    const afterNext = lines[i + 2];

    const isSeparatorDot = next === ".";
    const isUnitLine = afterNext && /^\d+\s*units?$/i.test(afterNext);
    const isWeightOrMeta =
      /^\d+\s*(kg|g|ml|l|pcs?|pc)\b/i.test(curr) ||
      /^approx\./i.test(curr) ||
      /^\d+\s*pcs?\./i.test(curr);

    if (isSeparatorDot && isUnitLine && isWeightOrMeta) {
      // Merge: "250 g" + "." + "2 units" → "250 g. 2 units"
      merged.push(`${curr}. ${afterNext}`);
      i += 3;
      continue;
    }

    merged.push(curr);
    i++;
  }

  // Step 6: Merge split price lines
  // "₹" on its own line followed by a number → merge into "₹24"
  const priceFixed: string[] = [];
  let j = 0;
  while (j < merged.length) {
    const curr = merged[j];
    const next = merged[j + 1];

    if (curr === "₹" && next && /^\d+(\.\d+)?$/.test(next)) {
      priceFixed.push(`₹${next}`);
      j += 2;
      continue;
    }

    priceFixed.push(curr);
    j++;
  }

  return priceFixed.join("\n").trim();
}

function parsePrice(text: string): number | undefined {
  const match = text.replace(/,/g, "").match(/₹\s*(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : undefined;
}

function parseQuantity(text: string): { quantity: number; meta?: string } {
  const qtyMatch = text.match(/(\d+)\s*units?/i);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  return { quantity, meta: text.trim() };
}

function parseOrderDate(text: string): Date | undefined {
  // "Mon, 18 May 2026 at 4:42 PM"
  const match = text.match(
    /(\w{3}),?\s+(\d{1,2})\s+(\w+)\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i
  );
  if (!match) return undefined;

  const [, , day, monthStr, year, hours, minutes, ampm] = match;
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const month = months[monthStr.toLowerCase().slice(0, 3)];
  if (month === undefined) return undefined;

  let hour = parseInt(hours, 10);
  if (ampm.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;

  return new Date(
    parseInt(year),
    month,
    parseInt(day),
    hour,
    parseInt(minutes)
  );
}

export function parseAmazonManualOrder(input: string): UnifiedOrder {
  const lines = input
    .split("\n")
    .map((line) => line.replace(/\u00a0/g, " ").trim())
    .filter(Boolean);

  if (!lines.length) throw new Error("No content pasted");

  // ── Order ID ──────────────────────────────────────────────────────────────
  const orderIdIndex = lines.findIndex(
    (line) => line.toLowerCase() === "order id"
  );
  if (orderIdIndex === -1 || !lines[orderIdIndex + 1]) {
    throw new Error("Could not find Amazon Order ID");
  }
  const rawOrderId = lines[orderIdIndex + 1].replace(/^#/, "").trim();

  // ── Order placed date ─────────────────────────────────────────────────────
  let placedAt: Date = new Date();
  const orderPlacedIndex = lines.findIndex(
    (line) => line.toLowerCase() === "order placed"
  );
  if (orderPlacedIndex !== -1 && lines[orderPlacedIndex + 1]) {
    const parsed = parseOrderDate(lines[orderPlacedIndex + 1]);
    if (parsed) placedAt = parsed;
  }

  // ── Delivery info ─────────────────────────────────────────────────────────
  let deliveryLabel = "Amazon manual import";
  const deliveredInLine = lines.find((line) =>
    /delivered in \d+ minutes?/i.test(line)
  );
  const arrivedAtLine = lines.find((line) => /arrived at/i.test(line));
  if (deliveredInLine && arrivedAtLine) {
    deliveryLabel = `${deliveredInLine} · ${arrivedAtLine}`;
  } else if (deliveredInLine) {
    deliveryLabel = deliveredInLine;
  }

  // ── Items section (between line 0 and "Bill summary") ────────────────────
  const billSummaryIndex = lines.findIndex(
    (line) => line.toLowerCase() === "bill summary"
  );
  if (billSummaryIndex === -1) throw new Error("Could not find Bill summary section");

  // Start after header lines like "Delivered in X min", "Arrived at...", "N items in order"
  const itemStartIndex = lines.findIndex((line) =>
    /^\d+\s+items?\s+in\s+order/i.test(line)
  );
  const itemsSection = lines.slice(
    itemStartIndex !== -1 ? itemStartIndex + 1 : 1,
    billSummaryIndex
  );

  const items: OrderItem[] = [];
  let i = 0;

  while (i < itemsSection.length) {
    const name = itemsSection[i];
    const meta = itemsSection[i + 1];
    const price1raw = itemsSection[i + 2];
    const price2raw = itemsSection[i + 3];

    if (!name || !meta || !price1raw) break;

    const parsedMeta = parseQuantity(meta);
    const price1 = parsePrice(price1raw);
    const price2 = price2raw ? parsePrice(price2raw) : undefined;

    // If both price1 and price2 are prices, use price1 (discounted/actual pay price)
    // price1 = discounted, price2 = MRP in this format
    if (price1 !== undefined && price2 !== undefined) {
      items.push({
        name,
        quantity: parsedMeta.quantity,
        price: price1,
        meta: parsedMeta.meta,
      });
      i += 4;
    } else if (price1 !== undefined) {
      items.push({
        name,
        quantity: parsedMeta.quantity,
        price: price1,
        meta: parsedMeta.meta,
      });
      i += 3;
    } else {
      break;
    }
  }

  // ── Total (from "You pay" section) ───────────────────────────────────────
  let totalAmount: number | undefined;
  const youPayIndex = lines.findIndex(
    (line) => line.toLowerCase() === "you pay"
  );
  if (youPayIndex !== -1) {
    const candidates = lines.slice(youPayIndex + 1, youPayIndex + 5);
    const prices = candidates
      .map(parsePrice)
      .filter((v): v is number => typeof v === "number");
    // Last price = final You Pay amount (after discounts)
    totalAmount = prices.at(-1);
  }

  const rawData: NonNullable<UnifiedOrder["rawData"]> = [
      { label: "Bill total", amount: totalAmount || 0, isTotal: true },
	];

  return {
    id: `amazon-manual-${rawOrderId}`,
    source: "amazon_now",
    placedAt,
    totalAmount,
    currency: "INR",
    status: "Imported manually",
    deliveryLabel,
    items,
    isManual: true,
    manualImportType: "amazon-text",
    rawData
  };
}