import type { UnifiedOrder, OrderItem } from "../types";

function parsePrice(text: string): number | undefined {
  const match = text.replace(/,/g, "").match(/₹\s*(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : undefined;
}

function parseQuantity(text: string): { quantity: number; meta?: string } {
  // examples:
  // "2 Pcs. 1 unit"
  // "500 g. 1 unit"
  // "250 g. 2 units"
  const qtyMatch = text.match(/(\d+)\s*units?/i);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  return {
    quantity,
    meta: text.trim(),
  };
}

export function parseAmazonManualOrder(input: string): UnifiedOrder {
  const lines = input
    .split("\n")
    .map((line) => line.replace(/\u00a0/g, " ").trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("No content pasted");
  }

  const orderIdIndex = lines.findIndex((line) =>
    line.toLowerCase() === "order id"
  );

  if (orderIdIndex === -1 || !lines[orderIdIndex + 1]) {
    throw new Error("Could not find Amazon order ID");
  }

  const rawOrderId = lines[orderIdIndex + 1].replace(/^#/, "").trim();

  const billSummaryIndex = lines.findIndex(
    (line) => line.toLowerCase() === "bill summary"
  );

  if (billSummaryIndex === -1) {
    throw new Error("Could not find Bill summary section");
  }

  const itemsSection = lines.slice(1, billSummaryIndex);
  const items: OrderItem[] = [];

  for (let i = 0; i < itemsSection.length; ) {
    const name = itemsSection[i];
    const meta = itemsSection[i + 1];
    const maybePrice1 = itemsSection[i + 2];
    const maybePrice2 = itemsSection[i + 3];

    if (!name || !meta || !maybePrice1) break;

    const parsedMeta = parseQuantity(meta);
    const firstPrice = parsePrice(maybePrice1);
    const secondPrice = parsePrice(maybePrice2 ?? "");

    items.push({
      name,
      quantity: parsedMeta.quantity,
      price: secondPrice ?? firstPrice,
      meta: parsedMeta.meta,
    });

    i += secondPrice !== undefined ? 4 : 3;
  }

  const youPayIndex = lines.findIndex((line) => line.toLowerCase() === "you pay");
  let totalAmount: number | undefined;

  if (youPayIndex !== -1) {
    const totalCandidates = lines.slice(youPayIndex + 1, youPayIndex + 4);
    const prices = totalCandidates
      .map(parsePrice)
      .filter((v): v is number => typeof v === "number");
    totalAmount = prices.at(-1);
  }

  return {
    id: `amazon-manual-${rawOrderId}`,
    source: "amazon_now",
    placedAt: new Date(),
    totalAmount,
    currency: "INR",
    status: "Imported manually",
    deliveryLabel: "Amazon manual import",
    items,
    isManual: true,
    manualImportType: "amazon-text",
  };
}