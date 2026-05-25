// src/features/orders/adapters/flipkartMinutesPdfImportAdapter.ts

import * as pdfjs from "pdfjs-dist";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";
import type { UnifiedOrder, OrderItem } from "../types";

// ─── PDF extraction ─────────────────────────────────────────────────────────

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
	return "str" in item;
}

export async function extractTextFromFlipkartPdf(file: File): Promise<string[][]> {
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseAmount(token: string): number | null {
	// Handles "₹ 117.00", "117.00", "-30.00", "1,234.56"
	const cleaned = token.replace(/₹/g, "").replace(/,/g, "").trim();
	const n = parseFloat(cleaned);
	return isNaN(n) ? null : n;
}

function parseDate(token: string): Date | null {
	// DD-MM-YYYY or DD/MM/YYYY or YYYY-MM-DD
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

function findTokenAfter(tokens: string[], ...keys: string[]): string | null {
	for (const key of keys) {
		const idx = tokens.findIndex(
			(t) => t.replace(/\s+/g, " ").toLowerCase() === key.toLowerCase()
		);
		if (idx !== -1 && tokens[idx + 1]) return tokens[idx + 1];
	}
	return null;
}

// ─── Page classifier ────────────────────────────────────────────────────────

function isBoilerplatePage(tokens: string[]): boolean {
	const joined = tokens.join(" ").toLowerCase();
	return (
		joined.includes("returns policy") ||
		joined.includes("flipkart.com/helpcentre") ||
		joined.includes("e. & o.e.") ||
		(joined.includes("page") && joined.includes("of") && !joined.includes("order id"))
	);
}

function isInvoicePage(tokens: string[]): boolean {
	const joined = tokens.join(" ").toLowerCase();
	return (
		joined.includes("tax invoice") ||
		joined.includes("order id:") ||
		joined.includes("total items:")
	);
}

// ─── Flipkart table parser ───────────────────────────────────────────────────
//
// The Flipkart Minutes table columns (in PDF reading order) are:
//   [Category+FSN+HSN block] [Product Title + tax rates] [Qty] [Gross ₹]
//   [Discounts ₹] [Taxable ₹] [SGST ₹] [CGST ₹] [Total ₹]
//
// Each real product row is followed by a "Handling Fee" row with total ₹0.00
// (the gross 10.00 is fully discounted). We skip handling fee rows.
//
// Strategy: Collect all tokens after the table header row and before the
// "Total" footer row. Then walk through them detecting row boundaries using
// the following heuristics:
//   1. Category labels (Ice Creams, Chips, Beverages, etc.) signal a new item
//   2. FSN: token signals the FSN code follows
//   3. After collecting meta, the title tokens come next
//   4. The last 6 tokens of a row are always: Qty, Gross, Discount, Taxable, SGST, CGST, Total (7 numerics)

interface ParsedItem {
	category: string;
	fsn: string;
	hsn: string;
	title: string;
	qty: number;
	grossAmount: number;
	discount: number;
	taxableValue: number;
	sgst: number;
	cgst: number;
	total: number;
	isHandlingFee: boolean;
}

// Tokens that represent known Flipkart product categories
const CATEGORY_HINTS = new Set([
	"Ice Creams", "Chips", "Soft Drinks", "Beverages", "Biscuits", "Snacks",
	"Dairy", "Bread & Bakery", "Fruits", "Vegetables", "Personal Care",
	"Household", "Frozen Foods", "Instant Food", "Oils", "Spices",
	"Rice & Grains", "Pulses", "Noodles", "Chocolates", "Juices",
	"Water & Soda", "Tea & Coffee", "Breakfast", "Baby Care", "Pet Care",
]);

// FSN pattern: 16-char alphanumeric
const FSN_RE = /^[A-Z0-9]{12,20}$/;

// HSN/SAC: 6-8 digit number
const HSN_RE = /^\d{6,8}$/;

// Tax rate patterns like "2.5 %SGST/UTGST:" or "2.5 %CGST:"
const TAX_RATE_RE = /^\d+(\.\d+)?\s*%/;

function parseItemsTable(tokens: string[]): ParsedItem[] {
	// Find where the table header ends
	// Header tokens: "Product" "Title" "Qty" "Gross" "Amount ₹" "Discounts" "/Coupons ₹" "Taxable" "Value ₹" "SGST" "/UTGST" "₹" "CGST" "₹" "Total ₹"
	const TABLE_HEADER_END_MARKER = "Total ₹";
	const TOTAL_ROW_MARKER = "Total";

	let tableStart = -1;
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i] === TABLE_HEADER_END_MARKER) {
			tableStart = i + 1;
			break;
		}
	}
	if (tableStart === -1) return [];

	// Find table end — the "Total" footer row (not inside an item)
	let tableEnd = tokens.length;

	for (let i = tableStart; i < tokens.length; i++) {
		if (tokens[i] !== "Total") continue;

		// The footer "Total" row must be followed by:
		// a small integer (total qty), then 6 more numerics in sequence
		const qtyCandidate = parseInt(tokens[i + 1] ?? "");
		if (isNaN(qtyCandidate) || qtyCandidate > 9999) continue;

		// Verify the full 7-numeric run exists right after "Total"
		const run = findNextNumericRun(tokens, i + 1, 7);
		if (!run || run.start !== i + 1) continue;

		// Confirmed footer Total row
		tableEnd = i;
		break;
	}

	for (let i = tableStart; i < tokens.length; i++) {
		if (
			tokens[i] === TOTAL_ROW_MARKER &&
			// The footer Total is preceded by nothing product-like,
			// and followed by a quantity like "3"
			tokens[i + 1] !== undefined &&
			!isNaN(parseInt(tokens[i + 1]))
		) {
			tableEnd = i;
			break;
		}
	}

	const tableTokens = tokens.slice(tableStart, tableEnd);

	// Walk through tableTokens building items
	const items: ParsedItem[] = [];
	let i = 0;

	while (i < tableTokens.length) {
		const tok = tableTokens[i];

		// Detect start of a new item block via FSN: prefix or FSN pattern
		if (tok === "FSN:" || (i + 1 < tableTokens.length && tableTokens[i] === "FSN:")) {
			i++;
			continue;
		}

		// Look for a block that starts with category name or a known product signal
		// We'll detect rows by finding numeric run of 7 values at the end of a row

		// Try to parse a run of 7 consecutive numeric tokens (the row columns)
		const numericRun = findNextNumericRun(tableTokens, i, 7);
		if (!numericRun) { i++; continue; }

		const { start: numStart, values } = numericRun;

		// Everything between i and numStart is the item metadata
		const metaTokens = tableTokens.slice(i, numStart);

		const parsed = extractItemMeta(metaTokens);
		if (!parsed.title) { i = numStart + 7; continue; }

		items.push({
			category: parsed.category,
			fsn: parsed.fsn,
			hsn: parsed.hsn,
			title: parsed.title,
			qty: Math.max(1, Math.round(values[0])),
			grossAmount: values[1],
			discount: values[2],
			taxableValue: values[3],
			sgst: values[4],
			cgst: values[5],
			total: values[6],
			isHandlingFee: parsed.title.toLowerCase() === "handling fee",
		});

		i = numStart + 7;
	}

	return items;
}

interface ItemMeta {
	category: string;
	fsn: string;
	hsn: string;
	title: string;
}

function extractItemMeta(metaTokens: string[]): ItemMeta {
	let category = "";
	let fsn = "";
	let hsn = "";
	const titleParts: string[] = [];

	let i = 0;
	while (i < metaTokens.length) {
		const tok = metaTokens[i];

		// Handle merged tokens like "HSN/SAC:21050000" or "FSN:ICEHEAFCCXHSGDUM"
		if (tok.startsWith("HSN/SAC:")) {
			hsn = tok.replace("HSN/SAC:", "").trim();
			i++;
			continue;
		}

		if (tok.startsWith("FSN:")) {
			fsn = tok.replace("FSN:", "").trim();
			i++;
			continue;
		}

		// Skip label + value pairs explicitly
		if (tok === "FSN:") {
			fsn = metaTokens[i + 1] ?? "";
			i += 2;  // skip label AND value
			continue;
		}

		if (tok === "HSN/SAC:") {
			hsn = metaTokens[i + 1] ?? "";
			i += 2;  // skip label AND value
			continue;
		}

		// Fallback: bare FSN code without label (12-20 char alphanumeric)
		if (FSN_RE.test(tok) && !fsn) { fsn = tok; i++; continue; }

		// Fallback: bare HSN code without label (6-8 digits)
		if (HSN_RE.test(tok) && !hsn) { hsn = tok; i++; continue; }

		// Tax rate tokens — skip
		if (TAX_RATE_RE.test(tok)) { i++; continue; }
		if (tok === "SGST/UTGST:" || tok === "CGST:") { i++; continue; }

		// Known category
		if (CATEGORY_HINTS.has(tok) && !category && !titleParts.length) {
			category = tok;
			i++;
			continue;
		}

		titleParts.push(tok);
		i++;
	}

	return { category, fsn, hsn, title: titleParts.join(" ").trim() };
}

interface NumericRun {
	start: number;
	values: number[];
}

/**
 * Find the next run of exactly `count` consecutive numeric tokens
 * starting at or after `fromIdx`.
 */
function findNextNumericRun(
	tokens: string[],
	fromIdx: number,
	count: number
): NumericRun | null {
	for (let i = fromIdx; i <= tokens.length - count; i++) {
		const run: number[] = [];
		for (let j = 0; j < count; j++) {
			const v = parseAmount(tokens[i + j]);
			if (v === null) break;
			run.push(v);
		}
		if (run.length === count) {
			return { start: i, values: run };
		}
	}
	return null;
}

// ─── Bill totals extractor ──────────────────────────────────────────────────

interface BillTotals {
	grossTotal: number;
	totalDiscount: number;
	grandTotal: number;
}

function parseBillTotals(tokens: string[]): BillTotals {
	let grossTotal = 0;
	let totalDiscount = 0;
	let grandTotal = 0;

	// "Total" footer row: Total | qty | Gross | Discount | Taxable | SGST | CGST | Total
	const totalIdx = tokens.findIndex(
		(t, i) =>
			t === "Total" &&
			tokens[i + 1] !== undefined &&
			!isNaN(parseInt(tokens[i + 1]))
	);

	if (totalIdx !== -1) {
		const run = findNextNumericRun(tokens, totalIdx + 1, 7);
		if (run) {
			grossTotal = run.values[1];
			totalDiscount = Math.abs(run.values[2]);
		}
	}

	// "Grand Total" is followed by "₹ 117.00" or "117.00"
	const grandIdx = tokens.findIndex(
		(t) => t.toLowerCase() === "grand total"
	);
	if (grandIdx !== -1) {
		// Try next 1-2 tokens
		for (let j = grandIdx + 1; j <= grandIdx + 3; j++) {
			const v = parseAmount(tokens[j] ?? "");
			if (v !== null && v > 0) {
				grandTotal = v;
				break;
			}
		}
	}

	return { grossTotal, totalDiscount, grandTotal };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function parseFlipkartMinutesInvoice(pages: string[][]): UnifiedOrder {
	if (!pages.length) throw new Error("PDF has no pages");

	// Flatten all invoice pages, skip boilerplate pages
	const invoiceTokens: string[] = [];

	for (const tokens of pages) {
		if (isBoilerplatePage(tokens)) continue;
		invoiceTokens.push(...tokens);
	}

	if (!invoiceTokens.length) throw new Error("No invoice content found in PDF");

	// ── Extract order metadata ────────────────────────────────────────────────

	// Order ID: "Order ID:" followed by "OD..." token
	const orderIdIdx = invoiceTokens.findIndex(
		(t) => t.replace(/\s+/g, " ").toLowerCase() === "order id:"
	);
	const orderId =
		orderIdIdx !== -1 ? invoiceTokens[orderIdIdx + 1] ?? null : null;

	if (!orderId || !orderId.startsWith("OD")) {
		throw new Error("Could not find a valid Flipkart Order ID (expected OD...)");
	}

	// Order Date — "Order Date:" token followed by date string
	const orderDateIdx = invoiceTokens.findIndex(
		(t) => t.replace(/\s+/g, " ").toLowerCase() === "order date:"
	);
	const orderDateStr =
		orderDateIdx !== -1 ? invoiceTokens[orderDateIdx + 1] ?? null : null;
	const orderDate = orderDateStr ? parseDate(orderDateStr) : null;

	// Sold By — "Sold By:" followed by seller name (may span multiple tokens)
	const soldByIdx = invoiceTokens.findIndex(
		(t) => t.toLowerCase().startsWith("sold by:")
	);
	let sellerName = "Flipkart Minutes";
	if (soldByIdx !== -1) {
		// "Sold By:" may be merged with name in same token: "Sold By:  Shreyash..."
		const soldByToken = invoiceTokens[soldByIdx];
		const inline = soldByToken.replace(/sold by:/i, "").trim();
		if (inline) {
			sellerName = inline;
		} else if (invoiceTokens[soldByIdx + 1]) {
			sellerName = invoiceTokens[soldByIdx + 1];
		}
	}

	// Invoice Number
	const invoiceNumIdx = invoiceTokens.findIndex(
		(t) => t.toLowerCase().includes("invoice number")
	);
	const invoiceNumber =
		invoiceNumIdx !== -1 ? (invoiceTokens[invoiceNumIdx + 1] ?? null) : null;

	// ── Parse items table ─────────────────────────────────────────────────────

	const parsedItems = parseItemsTable(invoiceTokens);

	// Filter out Handling Fee rows (gross 10, discount -10, total 0)
	const productItems = parsedItems.filter((item) => !item.isHandlingFee);

	const items: OrderItem[] = productItems.map((item) => ({
		name: item.title,
		quantity: item.qty,
		price: item.total,
		meta: item.category || undefined,
	}));

	// ── Bill totals ───────────────────────────────────────────────────────────

	const { grossTotal, totalDiscount, grandTotal } = parseBillTotals(invoiceTokens);

	// itemsTotal = sum of all product item totals (already post-discount, post-tax)
	const itemsTotal = productItems.reduce((s, item) => s + item.total, 0);

	// MRP = gross amount (before discounts), use from bill footer for accuracy
	const mrp = grossTotal || itemsTotal;

	// Product discount = MRP - items total
	const productDiscount = Math.max(0, mrp - itemsTotal);

	// Grand total from invoice footer is the source of truth
	const finalTotal = grandTotal || itemsTotal;

	// ── rawData bill summary ──────────────────────────────────────────────────

	const rawData: NonNullable<UnifiedOrder["rawData"]> = [
		{
			label: "MRP",
			amount: mrp,
			isTotal: false,
		},
		...(productDiscount > 0
			? [
				{
					label: "Product discount" as const,
					amount: -productDiscount,
					isTotal: false,
				},
			]
			: []),
		{
			label: "Item total",
			amount: itemsTotal,
			isTotal: false,
		},
		{
			label: "Bill total",
			amount: finalTotal,
			isTotal: true,
		},
	];

	return {
		id: `flipkart-${orderId}`,
		source: "flipkart_minutes",
		placedAt: orderDate ?? new Date(),
		totalAmount: finalTotal,
		currency: "INR",
		status: "Delivered",
		deliveryLabel: sellerName,
		items,
		isManual: true,
		manualImportType: "flipkart-pdf",
		rawData,
	};
}