import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
	Upload,
	X,
	CheckCircle2,
	Loader2,
	Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
	extractTextFromPdf,
	parseFirstClubInvoiceText,
} from "../adapters/firstclubPdfImportAdapter";
import { addManualOrder } from "../storage/manualOrdersStorage";
import type { UnifiedOrder } from "../types";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onImported: (order: UnifiedOrder) => void;
}

type Step = "upload" | "preview" | "importing" | "done";

export function FirstClubPdfImportDialog({ open, onOpenChange, onImported }: Props) {
	const [step, setStep] = useState<Step>("upload");
	const [dragOver, setDragOver] = useState(false);
	const [parsedOrder, setParsedOrder] = useState<UnifiedOrder | null>(null);
	const [parseError, setParseError] = useState<string | null>(null);
	const [isParsing, setIsParsing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const reset = () => {
		setStep("upload");
		setParsedOrder(null);
		setParseError(null);
		setIsParsing(false);
	};

	const handleClose = (v: boolean) => {
		if (!v) reset();
		onOpenChange(v);
	};

	const handleFile = async (f: File) => {
		if (!f.name.endsWith(".pdf")) {
			setParseError("Please upload a PDF file");
			return;
		}

		setParseError(null);
		setIsParsing(true);

		try {
			const text = await extractTextFromPdf(f);
			const order = parseFirstClubInvoiceText(text);

			if (!order.items.length) {
				throw new Error("No items found — make sure this is a FirstClub invoice PDF");
			}

			setParsedOrder(order);
			setStep("preview");
		} catch (err: any) {
			setParseError(err.message ?? "Failed to parse PDF");
		} finally {
			setIsParsing(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(false);
		const f = e.dataTransfer.files[0];
		if (f) handleFile(f);
	};

	const handleImport = () => {
		if (!parsedOrder) return;
		setStep("importing");

		try {
			addManualOrder(parsedOrder);
			onImported(parsedOrder);
			setStep("done");
		} catch (err: any) {
			toast.error("Import failed", { description: err.message });
			setStep("preview");
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Package className="h-5 w-5" />
						Import FirstClub order
					</DialogTitle>
					<DialogDescription>
						Upload the PDF invoice from your FirstClub order email
					</DialogDescription>
				</DialogHeader>

				{/* Step: Upload */}
				{(step === "upload" || isParsing) && (
					<div className="space-y-4">
						<input
							ref={inputRef}
							type="file"
							accept=".pdf"
							className="sr-only"
							onChange={(e) => {
								const f = e.target.files?.[0];
								if (f) handleFile(f);
							}}
						/>

						<div
							onClick={() => !isParsing && inputRef.current?.click()}
							onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
							onDragLeave={() => setDragOver(false)}
							onDrop={handleDrop}
							className={cn(
								"flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
								dragOver
									? "border-primary bg-primary/5"
									: "border-border hover:border-primary/50 hover:bg-muted/30",
								isParsing && "pointer-events-none opacity-60",
								"cursor-pointer"
							)}
						>
							{isParsing ? (
								<>
									<Loader2 className="h-8 w-8 animate-spin text-primary" />
									<p className="text-sm text-muted-foreground">
										Reading invoice…
									</p>
								</>
							) : (
								<>
									<Upload className="h-8 w-8 text-muted-foreground" />
									<div>
										<p className="font-medium">Drop your invoice PDF here</p>
										<p className="mt-1 text-sm text-muted-foreground">
											or click to browse
										</p>
									</div>
									<p className="text-xs text-muted-foreground">
										Trolleypop / FirstClub tax invoice format
									</p>
								</>
							)}
						</div>

						{parseError && (
							<p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
								{parseError}
							</p>
						)}
					</div>
				)}

				{/* Step: Preview */}
				{step === "preview" && parsedOrder && (
					<div className="space-y-4">
						{/* Order meta */}
						<div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Order ID</span>
								<span className="font-mono font-medium">
									{parsedOrder.id.replace("firstclub-", "")}
								</span>
							</div>
							<div className="mt-1 flex items-center justify-between">
								<span className="text-muted-foreground">Date</span>
								<span>
									{parsedOrder.placedAt.toLocaleDateString("en-IN", {
										day: "2-digit",
										month: "short",
										year: "numeric",
									})}
								</span>
							</div>
							<div className="mt-1 flex items-center justify-between font-semibold">
								<span>Total</span>
								<span>₹{parsedOrder.totalAmount?.toFixed(2)}</span>
							</div>
						</div>

						{/* Items list */}
						<div>
							<p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
								{parsedOrder.items.length} items
							</p>
							{/* ✅ Fixed height so it doesn't swallow the summary below */}
							<ScrollArea className="h-48 rounded-lg border">
								<div className="divide-y">
									{parsedOrder.items.map((item, idx) => (
										<div
											key={idx}
											className="flex items-center justify-between px-3 py-2.5 text-sm"
										>
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium">{item.name}</p>
												<p className="text-xs text-muted-foreground">qty {item.quantity}</p>
											</div>
											<span className="ml-3 shrink-0 tabular-nums font-medium">
												₹{item.price?.toFixed(2)}
											</span>
										</div>
									))}
								</div>
							</ScrollArea>
						</div>

						{/* Bill summary from rawData */}
						{parsedOrder.rawData && (
							<div className="rounded-lg border bg-muted/10 px-3 py-2.5 text-sm space-y-1">
								{parsedOrder.rawData.map((fee) => (
									<div className="flex justify-between text-muted-foreground">
										<span>{fee.label}</span>
										<span className="tabular-nums">₹{fee.amount?.toFixed(2)}</span>
									</div>
								))}
								<div className="flex justify-between border-t pt-1.5 font-semibold">
									<span>Total</span>
									<span className="tabular-nums">₹{parsedOrder.totalAmount?.toFixed(2)}</span>
								</div>
							</div>
						)}

						{/* Actions */}
						<div className="flex gap-2 pt-1">
							<Button
								variant="outline"
								className="flex-1"
								onClick={reset}
							>
								<X className="mr-2 h-4 w-4" />
								Change file
							</Button>
							<Button className="flex-1" onClick={handleImport}>
								Import order
							</Button>
						</div>
					</div>
				)}

				{/* Step: Done */}
				{step === "done" && (
					<div className="flex flex-col items-center gap-3 py-6 text-center">
						<CheckCircle2 className="h-12 w-12 text-green-500" />
						<div>
							<p className="font-semibold">Order imported!</p>
							<p className="mt-1 text-sm text-muted-foreground">
								₹{parsedOrder?.totalAmount?.toFixed(2)} ·{" "}
								{parsedOrder?.items.length} items
							</p>
						</div>
						<Button
							variant="outline"
							className="mt-2"
							onClick={() => handleClose(false)}
						>
							Done
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}