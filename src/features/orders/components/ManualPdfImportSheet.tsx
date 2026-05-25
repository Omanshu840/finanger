import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
	Upload,
	X,
	CheckCircle2,
	Loader2,
	Package,
	ArrowLeft,
	Plus,
	Trash2,
	ClipboardPaste,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
	extractTextFromFirstClubPdf,
	parseFirstClubInvoiceText,
} from "../adapters/firstclubPdfImportAdapter";
import { addManualOrder } from "../storage/manualOrdersStorage";
import type { OrderItem, UnifiedOrder } from "../types";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	extractTextFromSwiggyPdf,
	parseSwiggyInvoicePages,
} from "../adapters/swiggyPdfImportAdapter";
import {
	extractTextFromFlipkartPdf,
	parseFlipkartMinutesInvoice,
} from "../adapters/flipkartMinutesPdfImportAdapter";
import { parseAmazonManualOrder, sanitizePastedText } from "../adapters/amazonManualImportAdapter";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onImported: (order: UnifiedOrder) => void;
	activeIntegration:
	| null
	| "firstclub"
	| "swiggy"
	| "amazon"
	| "flipkart_minutes"
	| "amazon_now";
}

type Step = "upload" | "preview" | "importing" | "done";

interface DraftItem {
	name: string;
	qty: string;
	price: string;
}

const EMPTY_DRAFT: DraftItem = { name: "", qty: "1", price: "" };

// Integrations that use text paste instead of PDF upload
const TEXT_PASTE_INTEGRATIONS: Props["activeIntegration"][] = [
	"amazon",
	"amazon_now",
];

function getIntegrationLabel(
	integration: Props["activeIntegration"]
): string {
	switch (integration) {
		case "firstclub":
			return "FirstClub";
		case "swiggy":
			return "Swiggy";
		case "amazon":
			return "Amazon";
		case "amazon_now":
			return "Amazon Now";
		case "flipkart_minutes":
			return "Flipkart Minutes";
		default:
			return "Order";
	}
}

export function ManualPdfImportSheet({
	open,
	onOpenChange,
	onImported,
	activeIntegration,
}: Props) {
	const [step, setStep] = useState<Step>("upload");
	const [dragOver, setDragOver] = useState(false);
	const [parsedOrder, setParsedOrder] = useState<UnifiedOrder | null>(null);
	const [parseError, setParseError] = useState<string | null>(null);
	const [isParsing, setIsParsing] = useState(false);

	// Text paste state (Amazon / Amazon Now)
	const [pasteText, setPasteText] = useState("");

	// Manual item add state
	const [showAddItem, setShowAddItem] = useState(false);
	const [draft, setDraft] = useState<DraftItem>(EMPTY_DRAFT);
	const [draftError, setDraftError] = useState<string | null>(null);

	const inputRef = useRef<HTMLInputElement>(null);

	const isTextPaste = TEXT_PASTE_INTEGRATIONS.includes(activeIntegration);
	const integrationLabel = getIntegrationLabel(activeIntegration);

	const reset = () => {
		setStep("upload");
		setParsedOrder(null);
		setParseError(null);
		setIsParsing(false);
		setShowAddItem(false);
		setDraft(EMPTY_DRAFT);
		setDraftError(null);
		setPasteText("");
	};

	const handleClose = (v: boolean) => {
		if (!v) reset();
		onOpenChange(v);
	};

	// ── PDF handler ─────────────────────────────────────────────────────────────

	const handleFile = async (f: File) => {
		if (!f.name.endsWith(".pdf")) {
			setParseError("Please upload a PDF file");
			return;
		}

		setParseError(null);
		setIsParsing(true);

		try {
			let text;
			let order;

			if (activeIntegration === "firstclub") {
				text = await extractTextFromFirstClubPdf(f);
				order = parseFirstClubInvoiceText(text);
			} else if (activeIntegration === "swiggy") {
				text = await extractTextFromSwiggyPdf(f);
				order = parseSwiggyInvoicePages(text);
			} else if (activeIntegration === "flipkart_minutes") {
				text = await extractTextFromFlipkartPdf(f);
				order = parseFlipkartMinutesInvoice(text);
			} else {
				throw new Error("Unsupported integration for PDF upload");
			}

			if (!order?.items.length) {
				throw new Error(
					`No items found — make sure this is a ${integrationLabel} invoice PDF`
				);
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

	// ── Text paste handler ──────────────────────────────────────────────────────

	const handleTextParse = async () => {
		if (!pasteText.trim()) {
			setParseError("Please paste the order text first");
			return;
		}

		setParseError(null);
		setIsParsing(true);

		try {
			const order = parseAmazonManualOrder(pasteText);

			if (!order?.items.length) {
				throw new Error(
					"No items found — make sure you've pasted the full order details"
				);
			}

			setParsedOrder(order);
			setStep("preview");
		} catch (err: any) {
			setParseError(err.message ?? "Failed to parse order text");
		} finally {
			setIsParsing(false);
		}
	};

	// ── Manual item helpers ─────────────────────────────────────────────────────

	const commitDraftItem = () => {
		if (!draft.name.trim()) {
			setDraftError("Item name is required");
			return;
		}
		const qty = parseInt(draft.qty, 10);
		const price = parseFloat(draft.price);
		if (isNaN(qty) || qty < 1) {
			setDraftError("Quantity must be at least 1");
			return;
		}
		if (isNaN(price)) {
			setDraftError("Enter a valid price");
			return;
		}

		const newItem: OrderItem = {
			name: draft.name.trim(),
			quantity: qty,
			price,
		};

		setParsedOrder((prev) => {
			if (!prev) return prev;
			const updatedItems = [...prev.items, newItem];
			prev.rawData?.forEach((fee) => {
				if (fee.label === "Item total") {
					fee.amount = (fee.amount ?? 0) + price;
				}
				if (fee.label === "Bill total") {
					fee.amount = (fee.amount ?? 0) + price;
				}
			});
			const newTotal = (prev.totalAmount ?? 0) + price;
			return {
				...prev,
				items: updatedItems,
				totalAmount: newTotal,
				rawData: prev.rawData
			};
		});

		setDraft(EMPTY_DRAFT);
		setDraftError(null);
		setShowAddItem(false);
	};

	const removeItem = (idx: number) => {
		setParsedOrder((prev) => {
			if (!prev) return prev;
			const removed = prev.items[idx];
			const updatedItems = prev.items.filter((_, i) => i !== idx);
			const removedPrice = removed.price ?? 0;
			const newTotal = (prev.totalAmount ?? 0) - removedPrice;

			prev.rawData?.forEach((fee) => {
				if (fee.label === "Item total") {
					fee.amount = (fee.amount ?? 0) - removedPrice;
				}
				if (fee.label === "Bill total") {
					fee.amount = (fee.amount ?? 0) - removedPrice;
				}
			});

			return {
				...prev,
				items: updatedItems,
				totalAmount: newTotal,
				rawData: prev.rawData
			};
		});
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
		<Sheet open={open} onOpenChange={handleClose}>
			<SheetContent
				side="right"
				className="flex h-full w-full flex-col gap-0 overflow-scroll p-0 sm:max-w-md"
			>
				{/* Header */}
				<SheetHeader className="border-b px-6 py-4">
					<div className="flex items-center gap-3">
						{step === "preview" && (
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 shrink-0"
								onClick={reset}
								aria-label="Back"
							>
								<ArrowLeft className="h-4 w-4" />
							</Button>
						)}
						<div className="flex items-center gap-2">
							<Package className="h-5 w-5 text-muted-foreground" />
							<SheetTitle className="text-base">
								{step === "upload" && `Import ${integrationLabel} order`}
								{step === "preview" && "Review import"}
								{(step === "importing" || step === "done") &&
									"Import complete"}
							</SheetTitle>
						</div>
					</div>
					<SheetDescription className={cn(step === "preview" && "pl-11")}>
						{step === "upload" &&
							(isTextPaste
								? `Paste the order details from your ${integrationLabel} app`
								: `Upload the PDF invoice from your ${integrationLabel} order email`)}
						{step === "preview" && "Check the details before importing"}
						{(step === "importing" || step === "done") &&
							"Your order has been added to the orders list"}
					</SheetDescription>
				</SheetHeader>

				{/* Body */}
				<ScrollArea className="min-h-0 flex-1">
					<div className="px-6 py-5">

						{/* ── Step: Upload (PDF) ─────────────────────────────────────── */}
						{(step === "upload" || isParsing) && !isTextPaste && (
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
									onDragOver={(e) => {
										e.preventDefault();
										setDragOver(true);
									}}
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
												{integrationLabel} tax invoice format
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

						{/* ── Step: Upload (Text paste — Amazon / Amazon Now) ─────────── */}
						{(step === "upload" || isParsing) && isTextPaste && (
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="order-paste" className="text-sm font-medium">
										Order details
									</Label>
									<p className="text-xs text-muted-foreground">
										Open the {integrationLabel} app → Your Orders → select the
										order → long-press and copy all the text, then paste below.
									</p>
									<Textarea
										id="order-paste"
										value={pasteText}
										onChange={(e) => {
											setPasteText(e.target.value);
											setParseError(null);
										}}
										onPaste={(e) => {
											e.preventDefault();
											const raw = e.clipboardData.getData("text/plain");
											const cleaned = sanitizePastedText(raw);
											setPasteText(cleaned);
											setParseError(null);
										}}
										placeholder={`Paste ${integrationLabel} order text here…\n\nExample:\n4 items in order\nTata Salt\n1 kg. 1 unit\n₹27\n₹30\n…\nOrder ID\n#402-xxxxxxx-xxxxxxx`}
										className="min-h-[280px] resize-none font-mono text-xs leading-relaxed"
										disabled={isParsing}
									/>
								</div>

								{parseError && (
									<p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
										{parseError}
									</p>
								)}

								<Button
									className="w-full"
									onClick={handleTextParse}
									disabled={!pasteText.trim() || isParsing}
								>
									{isParsing ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Parsing…
										</>
									) : (
										<>
											<ClipboardPaste className="mr-2 h-4 w-4" />
											Parse order
										</>
									)}
								</Button>
							</div>
						)}

						{/* ── Step: Preview ──────────────────────────────────────────── */}
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
									<div className="rounded-lg border divide-y">
										{parsedOrder.items.map((item, idx) => (
											<div
												key={idx}
												className="group flex items-center justify-between px-4 py-2.5 text-sm"
											>
												<div className="flex-1 min-w-0">
													<p className="font-medium leading-snug break-words">{item.name}</p>
													<p className="text-xs text-muted-foreground mt-0.5">
														qty {item.quantity}
													</p>
												</div>
												<div className="ml-3 flex items-center gap-2">
													<span className="tabular-nums font-medium">
														₹{item.price?.toFixed(2)}
													</span>
													<button
														onClick={() => removeItem(idx)}
														aria-label={`Remove ${item.name}`}
														className="text-muted-foreground hover:text-destructive"
													>
														<Trash2 className="h-3.5 w-3.5" />
													</button>
												</div>
											</div>
										))}
									</div>
									{!showAddItem && (
										<Button
											variant={"secondary"}
											size="sm"
											className="h-7 mt-2 gap-1.5 text-xs"
											onClick={() => setShowAddItem(true)}
										>
											<Plus className="h-3.5 w-3.5" />
											Add item
										</Button>
									)}

									{/* Inline add-item form */}
									{showAddItem && (
										<div className="px-4 py-3 space-y-3 bg-muted/20">
											<div className="grid grid-cols-[1fr_64px_80px] gap-2">
												<div className="space-y-1">
													<Label className="text-xs text-muted-foreground">
														Name
													</Label>
													<Input
														autoFocus
														placeholder="Item name"
														value={draft.name}
														onChange={(e) =>
															setDraft((d) => ({
																...d,
																name: e.target.value,
															}))
														}
														onKeyDown={(e) =>
															e.key === "Enter" && commitDraftItem()
														}
														className="h-8 text-sm"
													/>
												</div>
												<div className="space-y-1">
													<Label className="text-xs text-muted-foreground">
														Qty
													</Label>
													<Input
														type="number"
														min={1}
														placeholder="1"
														value={draft.qty}
														onChange={(e) =>
															setDraft((d) => ({
																...d,
																qty: e.target.value,
															}))
														}
														onKeyDown={(e) =>
															e.key === "Enter" && commitDraftItem()
														}
														className="h-8 text-sm"
													/>
												</div>
												<div className="space-y-1">
													<Label className="text-xs text-muted-foreground">
														Price (₹)
													</Label>
													<Input
														type="number"
														min={0}
														placeholder="0.00"
														value={draft.price}
														onChange={(e) =>
															setDraft((d) => ({
																...d,
																price: e.target.value,
															}))
														}
														onKeyDown={(e) =>
															e.key === "Enter" && commitDraftItem()
														}
														className="h-8 text-sm"
													/>
												</div>
											</div>

											{draftError && (
												<p className="text-xs text-destructive">{draftError}</p>
											)}

											<div className="flex gap-2">
												<Button
													size="sm"
													className="h-8 flex-1 text-xs"
													onClick={commitDraftItem}
												>
													<Plus className="mr-1.5 h-3.5 w-3.5" />
													Add
												</Button>
												<Button
													size="sm"
													variant="ghost"
													className="h-8 px-3 text-xs"
													onClick={() => {
														setShowAddItem(false);
														setDraft(EMPTY_DRAFT);
														setDraftError(null);
													}}
												>
													<X className="h-3.5 w-3.5" />
												</Button>
											</div>
										</div>
									)}
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
								<div className="flex gap-2 py-4 border-t sticky bottom-0 bg-background">
									<Button
										variant="outline"
										className="flex-1"
										onClick={reset}
									>
										<X className="mr-2 h-4 w-4" />
										{isTextPaste ? "Clear" : "Change file"}
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
					</div>
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}