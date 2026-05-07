import { fetchBlinkitOrderDetails } from "@/features/blinkit/api/blinkitApi";
import type { BillLineItem, DetailedOrderItem, OrderDetail } from "../types";

// Input example: "~~<regular-200|{grey-600|₹119}>~~ ₹89"
//   MRP is inside {grey-600|₹119}  → captured by mrpMatch
//   Actual price is the trailing ₹89 → captured by priceMatch (last occurrence)
function parseMarkdownPrice(text: string): { price: number; mrp?: number } {
  // Last ₹ followed by digits (not inside braces) = actual paid price
  const allPrices = [...text.matchAll(/₹(\d+(?:\.\d+)?)/g)];
  const mrpMatch = text.match(/\{[^}]*₹(\d+(?:\.\d+)?)[^}]*\}/);

  const lastPrice = allPrices.at(-1);
  return {
    price: lastPrice ? parseFloat(lastPrice[1]) : 0,
    mrp: mrpMatch ? parseFloat(mrpMatch[1]) : undefined,
  };
}

// Parses "₹262", "-₹460", "+₹5", "FREE" → number
function parseBillAmount(text: string): number {
  if (!text || text.toUpperCase() === "FREE") return 0;
  const match = text.replace(/,/g, "").match(/-?₹?(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  return text.startsWith("-") ? -value : value;
}

export async function fetchBlinkitOrderDetail(
  accessToken: string,
  orderId: string,
  cartId: string,
  orderDate?: string 
): Promise<OrderDetail> {
  const snippets = await fetchBlinkitOrderDetails(accessToken, orderId, cartId);

  const items: DetailedOrderItem[] = [];
  const billLines: BillLineItem[] = [];

  for (const snippet of snippets) {
    // Product items
    if (snippet.widget_type === "z_v3_image_text_snippet_type_30") {
      const d = snippet.data ?? {};
      const { price, mrp } = parseMarkdownPrice(d.subtitle3?.text ?? "");
      const productId =
        snippet.tracking?.common_attributes?.product_id ?? String(Math.random());

      items.push({
        id: String(productId),
        name: d.title?.text ?? "Item",
        quantity: d.subtitle1?.text ?? "1",
        price,
        mrpPrice: mrp,
        imageUrl: d.image?.url,
      });
    }

    // Bill line items (MRP, discounts, charges, total)
    if (snippet.widget_type === "cart_bill_item") {
      const d = snippet.data ?? {};
      const label: string = d.left_header?.text ?? "";
      const amountText: string = d.right_header?.text ?? "";
      const amount = parseBillAmount(amountText);
      const isTotal = label.toLowerCase().includes("bill total");

      if (label) {
        billLines.push({ label, amount, isTotal });
      }
    }
  }

  const totalLine = billLines.find((b) => b.isTotal);
  const totalAmount = totalLine?.amount ?? items.reduce((s, i) => s + i.price, 0);

  return { orderId, cartId, orderDate: orderDate ?? null, items, billLines, totalAmount };
}