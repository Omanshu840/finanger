import { fetchOrderHistory } from "@/features/blinkit/api/blinkitApi";
import type { UnifiedOrder, OrderItem } from "../types";

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
  let placedAt = new Date();
  if (dateText) {
    // Append current year since Blinkit omits it
    const parsed = new Date(`${dateText} ${new Date().getFullYear()}`);
    if (!isNaN(parsed.getTime())) placedAt = parsed;
  }

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