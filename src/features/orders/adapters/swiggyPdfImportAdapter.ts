// src/features/orders/adapters/swiggyPdfImportAdapter.ts

import * as pdfjs from "pdfjs-dist";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";
import type { UnifiedOrder, OrderItem } from "../types";

// ─── PDF extraction ────────────────────────────────────────────────────────────

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
	return "str" in item;
}

export async function extractTextFromSwiggyPdf(file: File): Promise<string[][]> {
	const arrayBuffer = await file.arrayBuffer();
	const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
	const pages: string[][] = [];

	for (let i = 1; i <= pdf.numPages; i++) {
		const page = await pdf.getPage(i);
		const content = await page.getTextContent();
		const tokens = content.items
			.filter(isTextItem)
			.filter((item) => item.str.trim() !== "")
			.map((item) => item.str.trim());
		pages.push(tokens);
	}

	return pages;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseAmount(token: string): number | null {
	const cleaned = token.replace(/,/g, "").trim();
	const n = parseFloat(cleaned);
	return isNaN(n) ? null : n;
}

function parseDate(token: string): Date | null {
	const patterns: { re: RegExp; order: "dmy" | "ymd" }[] = [
		{ re: /^(\d{2})-(\d{2})-(\d{4})$/, order: "dmy" },
		{ re: /^(\d{2})\/(\d{2})\/(\d{4})$/, order: "dmy" },
		{ re: /^(\d{4})-(\d{2})-(\d{2})$/, order: "ymd" },
	];
	for (const { re, order } of patterns) {
		const m = token.match(re);
		if (!m) continue;
		const [, a, b, c] = m;
		const [d, mo, y] =
			order === "dmy"
				? [parseInt(a), parseInt(b) - 1, parseInt(c)]
				: [parseInt(c), parseInt(b) - 1, parseInt(a)];
		const date = new Date(y, mo, d);
		if (!isNaN(date.getTime())) return date;
	}
	return null;
}

function findValue(tokens: string[], ...keys: string[]): string | null {
	for (const key of keys) {
		const idx = tokens.findIndex(
			(t) => t.toLowerCase() === key.toLowerCase()
		);
		if (idx !== -1 && tokens[idx + 1]) return tokens[idx + 1];
	}
	return null;
}

// ─── Table parsing ─────────────────────────────────────────────────────────────

// UQC/UOM noise tokens that appear inside table rows but are not descriptions
const UOM_NOISE = new Set([
	"NOS", "OTH", "KGS", "LTR", "PCS", "BOX", "PKT",
	"BAG", "SET", "GMS", "MLT", "MTR", "SQM",
]);

// Known table header tokens to strip before row parsing starts
const TABLE_HEADER_NOISE = new Set([
	"sr", "srno", "sr no", "no", "description", "description of goods",
	"quantity", "uqc", "hsn/sac", "hsn", "hsn code", "taxable value",
	"taxable", "value", "discount", "excluding taxes", "net", "net taxable",
	"cgst%", "cgst", "sgst%", "sgst", "cess%", "cess", "additional cess",
	"total amount", "total amount (rs.)", "unit of measure", "unit price",
	"amount(rs.)", "amount (rs.)", "net assessable value(rs.)", "rs.", "(rs.)",
]);

interface TableRow {
	description: string;
	quantity: number;
	netAssessable: number; // final amount paid (post discount, post tax)
}

function parseLineItemTable(tokens: string[]): TableRow[] {
	const rows: TableRow[] = [];
	const rowNumberRe = /^\d+\.$/;
	const numericRe = /^-?\d+(\.\d+)?$/;

	let i = 0;
	while (i < tokens.length) {
		if (!rowNumberRe.test(tokens[i])) { i++; continue; }

		// Gather tokens until next row number or "Subtotal" or "Invoice Value"
		const rowStart = i + 1;
		let rowEnd = rowStart;
		while (rowEnd < tokens.length) {
			const t = tokens[rowEnd].toLowerCase();
			if (
				rowNumberRe.test(tokens[rowEnd]) ||
				t === "subtotal" ||
				t === "invoice value"
			) break;
			rowEnd++;
		}

		const rowTokens = tokens.slice(rowStart, rowEnd);
		if (!rowTokens.length) { i = rowEnd; continue; }

		// Split description (pre-numeric) from numbers (post-numeric)
		const firstNumIdx = rowTokens.findIndex((t) => numericRe.test(t));
		if (firstNumIdx === -1) { i = rowEnd; continue; }

		const descTokens = rowTokens
			.slice(0, firstNumIdx)
			.filter((t) => !UOM_NOISE.has(t.toUpperCase()))
			.filter((t) => {
				const low = t.toLowerCase();
				return !TABLE_HEADER_NOISE.has(low);
			});

		const description = descTokens.join(" ").trim();
		if (!description) { i = rowEnd; continue; }

		const numericValues = rowTokens
			.slice(firstNumIdx)
			.map(parseAmount)
			.filter((v): v is number => v !== null);

		if (!numericValues.length) { i = rowEnd; continue; }

		// quantity = first numeric, netAssessable = last numeric
		const quantity = Math.max(1, Math.round(numericValues[0]));
		const netAssessable = numericValues[numericValues.length - 1];

		rows.push({ description, quantity, netAssessable });
		i = rowEnd;
	}

	return rows;
}

// ─── Page classification ───────────────────────────────────────────────────────

type PageType = "product" | "fee" | "continuation" | "unknown";

/**
 * A continuation page has row tokens near the top but no TAX INVOICE header.
 * These are overflow pages from the previous invoice section.
 */
function isContinuationPage(tokens: string[]): boolean {
	const headerWindow = tokens.slice(0, 20);
	const hasTaxInvoice = headerWindow.some(
		(t) => t.toLowerCase() === "tax invoice"
	);
	const hasRowStart = headerWindow.some((t) => /^\d+\.$/.test(t));
	return !hasTaxInvoice && hasRowStart;
}

function classifyPage(tokens: string[]): PageType {
	const joined = tokens.join(" ").toLowerCase();

	// Product page: has a seller, goods table, "Invoice Value" footer
	if (
		joined.includes("description of goods") ||
		joined.includes("invoice value") ||
		joined.includes("seller name:") ||
		joined.includes("seller gstin:")
	) {
		return "product";
	}

	// Fee page: any swiggy-issued service invoice (delivery, handling,
	// platform fee, rain surcharge, packing, distance, etc.)
	if (
		joined.includes("invoice total") ||
		joined.includes("service description") ||
		joined.includes("handling fees") ||
		joined.includes("delivery fee") ||
		joined.includes("platform fee") ||
		joined.includes("net assessable value")
	) {
		return "fee";
	}

	return "unknown";
}

// ─── Fee label extractor ───────────────────────────────────────────────────────

/**
 * Derives a human-readable label for a fee page.
 * Looks at the "Service Description" field or the first line-item description.
 */
function extractFeeLabel(tokens: string[]): string {
	// Try explicit service description field
	const serviceDescIdx = tokens.findIndex(
		(t) => t.toLowerCase() === "service description:"
	);
	if (serviceDescIdx !== -1 && tokens[serviceDescIdx + 1]) {
		return tokens[serviceDescIdx + 1];
	}

	// Fallback: first line-item description from table
	const rows = parseLineItemTable(tokens);
	if (rows.length) {
		return rows[0].description;
	}

	return "Fee";
}

// ─── Page parsers ──────────────────────────────────────────────────────────────

interface ProductPageResult {
	orderId: string | null;
	invoiceNo: string | null;
	date: Date | null;
	sellerName: string | null;
	items: OrderItem[];
	invoiceValue: number | null;
}

function parseProductPage(tokens: string[]): ProductPageResult {
	const orderId = findValue(tokens, "Order ID:");
	const invoiceNo = findValue(tokens, "Invoice No:");
	const dateStr = findValue(tokens, "Date of Invoice:");
	const date = dateStr ? parseDate(dateStr) : null;

	const sellerIdx = tokens.findIndex(
		(t) => t.toLowerCase() === "seller name:"
	);
	const sellerName = sellerIdx !== -1 ? (tokens[sellerIdx + 1] ?? null) : null;

	const rows = parseLineItemTable(tokens);
	const items: OrderItem[] = rows.map((row) => ({
		name: row.description,
		quantity: row.quantity,
		price: row.netAssessable,
		meta: `qty ${row.quantity}`,
	}));

	// "Invoice Value" footer — the total charged for all goods on this page
	const invoiceValueIdx = tokens.findIndex(
		(t) => t.toLowerCase() === "invoice value"
	);
	const invoiceValue =
		invoiceValueIdx !== -1
			? parseAmount(tokens[invoiceValueIdx + 1] ?? "")
			: items.reduce((s, item) => s + (item.price ?? 0), 0) || null;

	return { orderId, invoiceNo, date, sellerName, items, invoiceValue };
}

interface FeePageResult {
	label: string;
	baseAmount: number;    // line item subtotal (pre-tax)
	totalWithTax: number;  // Invoice Total (incl. GST)
	orderId: string | null;
	date: Date | null;
}

function parseFeePage(tokens: string[]): FeePageResult {
	const orderId = findValue(tokens, "Order ID:");
	const dateStr = findValue(tokens, "Date of Invoice:");
	const date = dateStr ? parseDate(dateStr) : null;

	const label = extractFeeLabel(tokens);

	const rows = parseLineItemTable(tokens);
	const baseAmount = rows.reduce((s, r) => s + r.netAssessable, 0);

	// "Invoice Total" is the tax-inclusive total for this sub-invoice
	const invoiceTotalIdx = tokens.findIndex(
		(t) => t.toLowerCase() === "invoice total"
	);
	const totalWithTax =
		invoiceTotalIdx !== -1
			? (parseAmount(tokens[invoiceTotalIdx + 1] ?? "") ?? baseAmount)
			: baseAmount;

	return { label, baseAmount, totalWithTax, orderId, date };
}

// ─── Main export ───────────────────────────────────────────────────────────────

export interface SwiggyFeeBreakdown {
	label: string;
	amount: number;      // base pre-tax
	amountWithTax: number;
}

export function parseSwiggyInvoicePages(pages: string[][]): UnifiedOrder {
	if (!pages.length) throw new Error("PDF has no pages");

	let orderId: string | null = null;
	let date: Date | null = null;
	let sellerName: string | null = null;
	const allItems: OrderItem[] = [];
	let itemsTotal = 0;
	const fees: SwiggyFeeBreakdown[] = [];

	// Track last concrete type to handle continuation pages
	let lastConcreteType: "product" | "fee" = "product";

	for (const tokens of pages) {
		// Continuation page — inherits last concrete type
		if (isContinuationPage(tokens)) {
			if (lastConcreteType === "product") {
				const rows = parseLineItemTable(tokens);
				for (const row of rows) {
					allItems.push({
						name: row.description,
						quantity: row.quantity,
						price: row.netAssessable,
						meta: `qty ${row.quantity}`,
					});
					itemsTotal += row.netAssessable;
				}
			}
			// fee continuation: "Invoice Total" is on the original page, so
			// only additional line items (if any) are added to the last fee entry
			if (lastConcreteType === "fee" && fees.length) {
				const rows = parseLineItemTable(tokens);
				if (rows.length) {
					const last = fees[fees.length - 1];
					const extra = rows.reduce((s, r) => s + r.netAssessable, 0);
					fees[fees.length - 1] = {
						...last,
						amount: last.amount + extra,
						amountWithTax: last.amountWithTax + extra,
					};
				}
			}
			continue;
		}

		const pageType = classifyPage(tokens);

		if (pageType === "product") {
			lastConcreteType = "product";
			const result = parseProductPage(tokens);

			if (!orderId && result.orderId) orderId = result.orderId;
			if (!date && result.date) date = result.date;
			if (!sellerName && result.sellerName) sellerName = result.sellerName;

			allItems.push(...result.items);
			itemsTotal += result.invoiceValue ?? result.items.reduce((s, i) => s + (i.price ?? 0), 0);
		}

		if (pageType === "fee") {
			lastConcreteType = "fee";
			const result = parseFeePage(tokens);

			if (!orderId && result.orderId) orderId = result.orderId;
			if (!date && result.date) date = result.date;

			// Deduplicate by label (same fee can appear twice in some PDFs due to
			// Swiggy issuing separate GST-inclusive and GST-exclusive invoices)
			const existing = fees.findIndex(
				(f) => f.label.toLowerCase() === result.label.toLowerCase()
			);
			if (existing !== -1) {
				// Keep whichever has the higher amountWithTax (the GST-inclusive one)
				if (result.totalWithTax > fees[existing].amountWithTax) {
					fees[existing] = {
						label: result.label,
						amount: result.baseAmount,
						amountWithTax: result.totalWithTax,
					};
				}
			} else {
				fees.push({
					label: result.label,
					amount: result.baseAmount,
					amountWithTax: result.totalWithTax,
				});
			}
		}

		// "unknown" pages (tax summary pages, signature pages) are skipped —
		// they don't add new data, only summarise what's already captured
	}

	if (!orderId) throw new Error("Could not find Order ID in the PDF");

	const feesTotal = fees.reduce((s, f) => s + f.amountWithTax, 0);
	const totalAmount = itemsTotal + feesTotal;

	// Map parsed fees to the known rawData label schema
	const deliveryFee = fees.find((f) =>
		f.label.toLowerCase().includes("delivery")
	);
	const handlingFee = fees.find(
		(f) =>
			f.label.toLowerCase().includes("handling") ||
			f.label.toLowerCase().includes("platform")
	);

	// Items subtotal is the sum of all item prices before fees
	// MRP would need per-item MRP data which the PDF doesn't provide, so we
	// use itemsTotal as both MRP and Item total (no product discount available)
	const rawData: NonNullable<UnifiedOrder["rawData"]> = [
		{
			label: "MRP",
			amount: itemsTotal,
			isTotal: false,
		},
		{
			label: "Item total",
			amount: itemsTotal,
			isTotal: false,
		},
		...(handlingFee
			? [
				{
					label: "Handling charge" as const,
					amount: handlingFee.amountWithTax,
					isTotal: false,
				},
			]
			: []),
		...(deliveryFee
			? [
				{
					label: "Delivery charges" as const,
					amount: deliveryFee.amountWithTax,
					isTotal: false,
				},
			]
			: []),
		{
			label: "Bill total",
			amount: totalAmount,
			isTotal: true,
		},
	];

	return {
		id: `swiggy-${orderId}`,
		source: "swiggy",
		placedAt: date ?? new Date(),
		totalAmount,
		currency: "INR",
		status: "Imported manually",
		deliveryLabel: sellerName ?? "Swiggy Instamart",
		items: allItems,
		isManual: true,
		manualImportType: "swiggy-pdf",
		rawData,
	};
}