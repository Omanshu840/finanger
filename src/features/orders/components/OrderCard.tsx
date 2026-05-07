import type { UnifiedOrder, IntegrationMeta } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Banana, Carrot, ChevronDown, ChevronUp, CupSoda, Popsicle, Sandwich, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Props {
  order: UnifiedOrder;
  meta: IntegrationMeta;
  onImportToSplitwise: (order: UnifiedOrder) => void;
}

const STATUS_STYLES: Record<string, string> = {
  DELIVERED:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400",
  CANCELLED:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
  PENDING:
    "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400",
};

const ProductIcons = [
  <CupSoda className="h-6 w-6 rounded-lg border-2 border-background bg-muted/60" />,
  <Carrot className="h-6 w-6 rounded-lg border-2 border-background bg-muted/60" />,
  <Banana className="h-6 w-6 rounded-lg border-2 border-background bg-muted/60" />,
  <Popsicle className="h-6 w-6 rounded-lg border-2 border-background bg-muted/60" />,
  <Sandwich className="h-6 w-6 rounded-lg border-2 border-background bg-muted/60" />,
]

export function OrderCard({ order, meta, onImportToSplitwise }: Props) {
  const [expanded, setExpanded] = useState(false);

  const statusStyle =
    STATUS_STYLES[order.status?.toUpperCase() ?? ""] ?? "border-border";

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md py-2">
      <CardContent className="p-0" onClick={() => setExpanded(!expanded)}>
        {/* Main header */}
        <div className="flex items-start gap-3 p-4">
          {/* Source icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-muted/40 text-xl">
            {meta.logoUrl ? (
              <img src={meta.logoUrl} alt={meta.label} className="h-full w-full object-contain" />
            ) : (
              <span>{meta.label.charAt(0)}</span>
            )}
          </div>

          {/* Order meta */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{meta.label}</span>
              {order.status && (
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs font-medium",
                    statusStyle
                  )}
                >
                  {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="text-sm text-muted-foreground">
                {format(order.placedAt, "d MMM, h:mm a")}
              </span>
              {order.totalAmount != null && (
                <span className="text-sm font-semibold tabular-nums">
                  ₹{order.totalAmount.toFixed(0)}
                </span>
              )}
            </div>

            {/* Delivery time badge */}
            {order.deliveryLabel && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Zap className="h-3 w-3 text-yellow-500" />
                {order.deliveryLabel}
              </div>
            )}
          </div>

          {/* Product image strip — always visible */}
          {order.items.length > 0 && !expanded && (
            <div className="flex shrink-0 items-center -space-x-2">
              {order.items.slice(0, 4).map((item, idx) =>
                item.imageUrl ? (
                  <img
                    key={idx}
                    src={item.imageUrl}
                    alt={item.name}
                    width={36}
                    height={36}
                    loading="lazy"
                    className="h-9 w-9 rounded-lg border-2 border-background object-cover shadow-sm"
                  />
                ) : (
                  ProductIcons[idx % ProductIcons.length]
                )
              )}
              {order.items.length > 4 && (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-background bg-muted text-xs font-medium text-muted-foreground shadow-sm">
                  +{order.items.length - 4}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expanded items list */}
        {expanded && order.items.length > 0 && (
          <div className="border-t bg-muted/20 px-4 py-3">
            <ul className="space-y-2">
              {order.items.map((item, idx) => (
                <li key={idx} className="flex items-center gap-3 text-sm">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      width={40}
                      height={40}
                      loading="lazy"
                      className="h-10 w-10 shrink-0 rounded-lg border object-cover"
                    />
                  ) : (
                    ProductIcons[idx % ProductIcons.length]
                  )}
                  <span className="flex-1 text-foreground">{item.name}</span>
                  {item.price != null && (
                    <span className="tabular-nums text-muted-foreground">
                      ₹{item.price.toFixed(2)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between border-t bg-muted/10 px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => onImportToSplitwise(order)}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Import to Splitwise
          </Button>

          {order.items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Hide items
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}