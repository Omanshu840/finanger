import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ManualAmazonImportDialog } from "./ManualAmazonImportDialog";
import { ManualPdfImportSheet } from "./ManualPdfImportSheet";
import type { UnifiedOrder } from "../types";

interface Props {
  onImported: (order: UnifiedOrder) => void;
}

type ActiveDialog = null | "amazon" | "firstclub" | "swiggy" | "flipkart_minutes" | "amazon_now" | "custom";

export function ImportOrdersDropdown({ onImported }: Props) {
  const [active, setActive] = useState<ActiveDialog>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Import order
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Paste text
          </DropdownMenuLabel>

          <DropdownMenuItem onClick={() => setActive("amazon_now")}>
            Amazon Now
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Upload PDF
          </DropdownMenuLabel>

          <DropdownMenuItem onClick={() => setActive("firstclub")}>
            FirstClub
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setActive("swiggy")}>
            Swiggy
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setActive("flipkart_minutes")}>
            Flipkart Minutes
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Manual Entry
          </DropdownMenuLabel>

          <DropdownMenuItem onClick={() => setActive("custom")}>
            Custom Order
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ManualAmazonImportDialog
        open={active === "amazon"}
        onOpenChange={(v) => !v && setActive(null)}
        onImported={(order) => {
          onImported(order);
          setActive(null);
        }}
      />

      <ManualPdfImportSheet
        open={active === "firstclub" || active === "swiggy" || active === "flipkart_minutes" || active === "amazon_now" || active === "custom"}
        activeIntegration={active}
        onOpenChange={(v) => !v && setActive(null)}
        onImported={(order) => {
          onImported(order);
          setActive(null);
        }}
      />
    </>
  );
}