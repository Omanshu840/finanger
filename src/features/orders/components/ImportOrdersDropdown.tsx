import { useState } from "react";
import { Plus, ChevronDown, Package } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ManualAmazonImportDialog } from "./ManualAmazonImportDialog";
import { FirstClubPdfImportDialog } from "./FirstClubPdfImportDialog";
import type { UnifiedOrder } from "../types";

interface Props {
  onImported: (order: UnifiedOrder) => void;
}

type ActiveDialog = null | "amazon" | "firstclub";

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
          {/* <DropdownMenuLabel className="text-xs text-muted-foreground">
            Paste text
          </DropdownMenuLabel> */}

          {/* <DropdownMenuItem onClick={() => setActive("amazon")}>
            <FileText className="mr-2 h-4 w-4" />
            Amazon
          </DropdownMenuItem>

          <DropdownMenuSeparator /> */}

          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Upload PDF
          </DropdownMenuLabel>

          <DropdownMenuItem onClick={() => setActive("firstclub")}>
            <Package className="mr-2 h-4 w-4" />
            FirstClub
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

      <FirstClubPdfImportDialog
        open={active === "firstclub"}
        onOpenChange={(v) => !v && setActive(null)}
        onImported={(order) => {
          onImported(order);
          setActive(null);
        }}
      />
    </>
  );
}