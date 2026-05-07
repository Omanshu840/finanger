import type { UnifiedOrder } from "../types";

const STORAGE_KEY = "manual_imported_orders_v1";

type StoredOrder = Omit<UnifiedOrder, "placedAt"> & {
  placedAt: string;
};

export function getManualOrders(): UnifiedOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: StoredOrder[] = JSON.parse(raw);
    return parsed.map((order) => ({
      ...order,
      placedAt: new Date(order.placedAt),
    }));
  } catch (error) {
    console.error("Failed to read manual orders", error);
    return [];
  }
}

export function saveManualOrders(orders: UnifiedOrder[]) {
  try {
    const serialized: StoredOrder[] = orders.map((order) => ({
      ...order,
      placedAt: order.placedAt.toISOString(),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error("Failed to save manual orders", error);
  }
}

export function addManualOrder(order: UnifiedOrder) {
  const existing = getManualOrders();
  saveManualOrders([order, ...existing]);
}