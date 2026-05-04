export type IntegrationSource =
  | "blinkit"
  | "swiggy"
  | "zomato"
  | "zepto"
  | "firstclub"
  | "amazon_now"
  | "flipkart_minutes";

export interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
  imageUrl?: string;   // ← add this
}

export interface UnifiedOrder {
  id: string;
  source: IntegrationSource;
  placedAt: Date;
  totalAmount?: number;
  currency?: string;
  status?: string;
  items: OrderItem[];
  rawData?: unknown;
  deliveryLabel?: string;
}

export interface IntegrationMeta {
  key: IntegrationSource;
  label: string;
  color: string;           // tailwind bg class for badge
  textColor: string;       // tailwind text class for badge
  emoji: string;
  isConnected: boolean;
  isSupported: boolean;    // false = "coming soon"
}