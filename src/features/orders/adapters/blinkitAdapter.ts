import { fetchOrderHistory } from "@/features/blinkit/api/blinkitApi";
import type { UnifiedOrder, OrderItem } from "../types";


const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function parseBlinkitDate(dateText: string): Date | null {
  if (!dateText) return null;

  const text = dateText.trim().replace(/\s+/g, " ");

  // Case 1: "19 Mar, 10:16 am" -> current year
  const withTimeMatch = text.match(
    /^(\d{1,2})\s([A-Za-z]{3}),\s(\d{1,2}):(\d{2})\s(am|pm)$/i
  );

  if (withTimeMatch) {
    const [, dayStr, monthStr, hourStr, minuteStr, ampm] = withTimeMatch;
    const day = Number(dayStr);
    const month = MONTHS[monthStr.toLowerCase()];
    const year = new Date().getFullYear();

    let hour = Number(hourStr);
    const minute = Number(minuteStr);

    if (ampm.toLowerCase() === "pm" && hour !== 12) hour += 12;
    if (ampm.toLowerCase() === "am" && hour === 12) hour = 0;

    return new Date(year, month, day, hour, minute, 0, 0);
  }

  // Case 2: "06 Nov 2025", "15 Jun 2025", "23 Feb 2025"
  const dateOnlyMatch = text.match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/i);

  if (dateOnlyMatch) {
    const [, dayStr, monthStr, yearStr] = dateOnlyMatch;
    const day = Number(dayStr);
    const month = MONTHS[monthStr.toLowerCase()];
    const year = Number(yearStr);

    return new Date(year, month, day, 12, 0, 0, 0);
  }

  return null;
}


function parseOrderContainer(snippet: any): UnifiedOrder | null {
  const d = snippet?.data ?? {};
  const items: any[] = d.items ?? [];

  // Header widget — contains order ID, amount, date, status, delivery time
  const header = items.find(
    (i: any) => i.widget_type === "image_text_vr_type_header"
  );

  // Product images widget — horizontal list
  const productList = items.find(
    (i: any) => i.widget_type === "horizontal_list"
  );

  if (!header) return null;

  const headerData = header?.data ?? {};
  const headerTracking = header?.tracking?.common_attributes ?? {};

  // Order ID from identity or tracking
  const rawId =
    d.identity?.id ??
    headerTracking?.order_id ??
    null;
  if (!rawId) return null;

  const orderId = String(headerTracking?.order_id ?? rawId);

  // Amount — strip "₹" and parse
  const amountText: string =
    headerData?.left_underlined_subtitle?.text ?? "";
  const totalAmount = amountText
    ? parseFloat(amountText.replace(/[₹,]/g, "").trim()) || undefined
    : undefined;

  // Date — "19 Mar, 10:16 am" — parse manually
  const dateText: string = headerData?.subtitle?.text ?? "";
  const parsedDate = parseBlinkitDate(dateText);
  if (!parsedDate) {
    console.warn("Failed to parse Blinkit date:", dateText);
  }
  const placedAt = parsedDate ?? new Date();

  // Delivery time label e.g. "Arrived in 9 minutes"
  const deliveryLabel: string = headerData?.title?.text ?? "";

  // Status
  const status: string = headerTracking?.order_status ?? undefined;

  // Products from horizontal list
  const orderItems: OrderItem[] = (
    productList?.data?.horizontal_item_list ?? []
  ).map((p: any) => ({
    name: p.data?.image?.accessibility_text?.text ?? "Item",
    quantity: 1,
    price: undefined,
    imageUrl: p.data?.image?.url ?? undefined,
  }));

  return {
    id: orderId,
    source: "blinkit",
    placedAt,
    totalAmount,
    currency: "INR",
    status,
    deliveryLabel,           // pass through for display
    items: orderItems,
    rawData: snippet,
  };
}

export async function fetchBlinkitOrders(
  accessToken: string
): Promise<UnifiedOrder[]> {
  const snippets = await fetchOrderHistory(accessToken);

  return snippets
    .filter((s: any) => s.widget_type === "order_history_container_vr")
    .map(parseOrderContainer)
    .filter((o): o is UnifiedOrder => o !== null);
}