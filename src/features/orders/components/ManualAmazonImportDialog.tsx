import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { parseAmazonManualOrder } from "../adapters/amazonManualImportAdapter";
import { addManualOrder } from "../storage/manualOrdersStorage";
import type { UnifiedOrder } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (order: UnifiedOrder) => void;
}

export function ManualAmazonImportDialog({
  open,
  onOpenChange,
  onImported,
}: Props) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleImport = async () => {
    try {
      setSubmitting(true);
      const order = parseAmazonManualOrder(value);
      addManualOrder(order);
      onImported(order);
      toast.success("Amazon order imported");
      setValue("");
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Import failed", {
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            Import Amazon order
          </DialogTitle>
          <DialogDescription>
            Paste the order text from Amazon. Items, quantities, order ID, and total will be extracted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste Amazon order details here..."
            className="min-h-[320px] resize-y font-mono text-sm"
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!value.trim() || submitting}>
              {submitting ? "Importing..." : "Import order"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}