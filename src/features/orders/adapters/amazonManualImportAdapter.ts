import type { UnifiedOrder, OrderItem } from "../types";

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

  // ── Payment method ────────────────────────────────────────────────────────
  let paymentMethod: string | undefined;
  const paymentIndex = lines.findIndex(
    (line) => line.toLowerCase() === "payment"
  );
  if (paymentIndex !== -1 && lines[paymentIndex + 1]) {
    paymentMethod = lines[paymentIndex + 1];
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