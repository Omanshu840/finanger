export type IntegrationSource =
  | "blinkit"
  | "swiggy"
  | "zomato"
  | "zepto"
  | "firstclub"
  | "amazon_now"
  | "flipkart_minutes";


 export const INTEGRATION_LABELS: Record<IntegrationSource, string> = {
 	blinkit: "Blinkit",
 	swiggy: "Swiggy",
 	zomato: "Zomato",
 	zepto: "Zepto",
 	firstclub: "FirstClub",
 	amazon_now: "Amazon Now",
 	flipkart_minutes: "Flipkart Minutes",
 }; 

export interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
  imageUrl?: string;   // ← add this
  meta?: string; // for any additional metadata (e.g., size, color)
}

export interface UnifiedOrder {
  id: string;
  source: IntegrationSource;
  placedAt: Date;
  totalAmount?: number;
  currency?: string;
  status?: string;
  items: OrderItem[];
  rawData?: {
    label: "MRP"
    | "Product discount"
    | "Item total"
    | "Handling charge"
    | "Delivery charges"
    | "Bill total";
    amount: number;
    isTotal: boolean;
  }[];
  deliveryLabel?: string;

  // For manual orders (e.g., imported via Amazon Text), we can have additional metadata
  isManual?: boolean;
  manualImportType?: "amazon-text" | "firstclub-pdf"; // extendable for other manual import types
}

export interface IntegrationMeta {
  key: IntegrationSource;
  label: string;
  color: string;           // tailwind bg class for badge
  textColor: string;       // tailwind text class for badge
  logoUrl: string;
  isConnected: boolean;
  isSupported: boolean;    // false = "coming soon"
}

export interface DetailedOrderItem {
  id: string;
  name: string;
  quantity: string;       // "1 pair x 1"
  price: number;          // actual paid price
  mrpPrice?: number;
  imageUrl?: string;
}

export interface BillLineItem {
  label: string;
  amount: number;         // negative = discount, positive = charge
  isTotal: boolean;
}

export interface OrderDetail {
  orderId: string;
  orderDate: string | null;
  cartId: string;
  items: DetailedOrderItem[];
  billLines: BillLineItem[];
  totalAmount: number;
  source?: IntegrationSource;
}