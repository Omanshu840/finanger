// src/features/orders/adapters/flipkartMinutesPdfImportAdapter.ts

import * as pdfjs from "pdfjs-dist";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";
import type { UnifiedOrder, OrderItem } from "../types";

// ─── PDF extraction ──────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAmount(token: string): number | null {
	const cleaned = token.replace(/₹/g, "").replace(/,/g, "").trim();
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

/**
 * Robust Order ID extractor. Handles three token layouts pdfjs produces:
 *   1. ["Order ID:", "OD3375..."]          — label and value split
 *   2. ["Order ID: OD3375..."]             — merged in single token
 *   3. ["Order ID:", "\n", "OD3375..."]    — newline token between them
 */
function extractOrderId(tokens: string[]): string | null {
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];

		// Case 2: merged token "Order ID: OD..."
		const mergedMatch = t.match(/order\s*id[:\s]+((OD|od)\w+)/i);
		if (mergedMatch) return mergedMatch[1].toUpperCase();

		// Case 1 & 3: label token, then scan next few tokens for OD value
		if (t.replace(/\s+/g, " ").toLowerCase().trim() === "order id:") {
			for (let j = i + 1; j <= i + 4 && j < tokens.length; j++) {
				const candidate = tokens[j].trim();
				if (/^OD\d{10,}/i.test(candidate)) {
					return candidate.toUpperCase();
				}
			}
		}
	}

	// Last resort: scan all tokens for anything that looks like an OD order ID
	for (const t of tokens) {
		const m = t.match(/\b(OD\d{10,})\b/i);
		if (m) return m[1].toUpperCase();
	}

	return null;
}

function extractDate(tokens: string[]): Date | null {
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i].toLowerCase().trim();
		if (t === "order date:" || t.startsWith("order date:")) {
			// Check inline: "Order Date: 25-05-2026"
			const inline = tokens[i].match(/order date[:\s]+(\d{2}[-/]\d{2}[-/]\d{4})/i);
			if (inline) return parseDate(inline[1]);
			// Next token
			for (let j = i + 1; j <= i + 3 && j < tokens.length; j++) {
				const d = parseDate(tokens[j]);
				if (d) return d;
			}
		}
	}
	return null;
}

function extractSellerName(tokens: string[]): string | null {
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		// "Sold By: Shreyash..." — may be inline or split
		if (/sold by:/i.test(t)) {
			const inline = t.replace(/sold by:/i, "").trim();
			if (inline) return inline.replace(/,$/, "").trim();
			if (tokens[i + 1]) return tokens[i + 1].replace(/,$/, "").trim();
		}
	}
	return null;
}

// ─── Page classifier ─────────────────────────────────────────────────────────

function isBoilerplatePage(tokens: string[]): boolean {
	const joined = tokens.join(" ").toLowerCase();
	// A page is pure boilerplate if it has no order ID and only returns policy / contact info
	const hasOrderId = /\bOD\d{10,}/i.test(joined);
	const hasReturnPolicy = joined.includes("returns policy") || joined.includes("flipkart.com/helpcentre");
	return !hasOrderId && hasReturnPolicy;
}

function isInvoicePage(tokens: string[]): boolean {
	const joined = tokens.join(" ").toLowerCase();
	return (
		joined.includes("tax invoice") ||
		/\bOD\d{10,}/i.test(joined) ||
		joined.includes("total items:")
	);
}

// ─── Table parsing ────────────────────────────────────────────────────────────

const UOM_NOISE = new Set([
	"NOS", "OTH", "KGS", "LTR", "PCS", "BOX", "PKT",
	"BAG", "SET", "GMS", "MLT", "MTR", "SQM",
]);

const TAX_RATE_RE = /^\d+(\.\d+)?\s*%/;
const FSN_RE = /^[A-Z0-9]{12,20}$/;

interface ParsedItem {
	category: string;
	title: string;
	qty: number;
	grossAmount: number;
	discount: number;
	total: number;
	isHandlingFee: boolean;
}

interface NumericRun {
	start: number;
	values: number[];
}

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
		if (run.length === count) return { start: i, values: run };
	}
	return null;
}

interface ItemMeta {
	category: string;
	title: string;
}

function extractItemMeta(metaTokens: string[]): ItemMeta {
	let category = "";
	const titleParts: string[] = [];

	let i = 0;
	while (i < metaTokens.length) {
		const tok = metaTokens[i];

		// Handle merged "FSN:XXXXXX" or "HSN/SAC:12345"
		if (/^FSN:/i.test(tok)) { i++; continue; }
		if (/^HSN\/SAC:/i.test(tok)) { i++; continue; }

		// Split label tokens — skip label AND next value token
		if (tok === "FSN:") { i += 2; continue; }
		if (tok === "HSN/SAC:") { i += 2; continue; }

		// Bare FSN code
		if (FSN_RE.test(tok)) { i++; continue; }

		// Bare HSN code — also catches "96032900aa" via startsWith digit check
		if (/^\d{6}/.test(tok) && tok.length <= 12) { i++; continue; }

		// Tax rate / label noise
		if (TAX_RATE_RE.test(tok)) { i++; continue; }
		if (tok === "SGST/UTGST:" || tok === "CGST:") { i++; continue; }

		// UOM noise
		if (UOM_NOISE.has(tok.toUpperCase())) { i++; continue; }

		// "Warranty: No" pattern
		if (/^warranty:/i.test(tok)) { i += 2; continue; }

		// First text token with no prior category → could be category
		if (!category && !titleParts.length) {
			category = tok;
			i++;
			continue;
		}

		titleParts.push(tok);
		i++;
	}

	return { category, title: titleParts.join(" ").trim() };
}

function parseItemsTable(tokens: string[]): ParsedItem[] {
	const items: ParsedItem[] = [];

	// Find table header end marker
	let tableStart = -1;
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i] === "Total ₹") {
			tableStart = i + 1;
			break;
		}
	}
	if (tableStart === -1) return [];

	// Find table footer — "Total" followed immediately by a numeric run of 7
	let tableEnd = tokens.length;
	for (let i = tableStart; i < tokens.length; i++) {
		if (tokens[i] !== "Total") continue;
		const run = findNextNumericRun(tokens, i + 1, 7);
		if (run && run.start === i + 1) {
			tableEnd = i;
			break;
		}
	}

	const tableTokens = tokens.slice(tableStart, tableEnd);
	let i = 0;

	while (i < tableTokens.length) {
		const numericRun = findNextNumericRun(tableTokens, i, 7);
		if (!numericRun) break;

		const metaTokens = tableTokens.slice(i, numericRun.start);
		const meta = extractItemMeta(metaTokens);

		// Skip rows with no title at all
		if (!meta.title && !meta.category) {
			i = numericRun.start + 7;
			continue;
		}

		const [qty, grossAmount, discount, , , , total] = numericRun.values;
		const effectiveTitle = meta.title || meta.category;

		items.push({
			category: meta.category,
			title: effectiveTitle,
			qty: Math.max(1, Math.round(qty)),
			grossAmount,
			discount,
			total,
			isHandlingFee: effectiveTitle.toLowerCase() === "handling fee",
		});

		i = numericRun.start + 7;
	}

	return items;
}

// ─── Per-invoice-page parser ──────────────────────────────────────────────────

interface InvoicePageResult {
	orderId: string | null;
	date: Date | null;
	sellerName: string | null;
	items: OrderItem[];
	grossTotal: number;
	discount: number;
	grandTotal: number;
}

function parseInvoicePage(tokens: string[]): InvoicePageResult {
	const orderId = extractOrderId(tokens);
	const date = extractDate(tokens);
	const sellerName = extractSellerName(tokens);

	const parsedItems = parseItemsTable(tokens);
	const productItems = parsedItems.filter((p) => !p.isHandlingFee);

	const items: OrderItem[] = productItems.map((item) => ({
		name: item.title,
		quantity: item.qty,
		price: item.total,
		meta: item.category || undefined,
	}));

	// Bill footer totals
	const totalFooterIdx = tokens.findIndex((t, i) => {
		if (t !== "Total") return false;
		const run = findNextNumericRun(tokens, i + 1, 7);
		return run?.start === i + 1;
	});

	let grossTotal = 0;
	let discount = 0;

	if (totalFooterIdx !== -1) {
		const run = findNextNumericRun(tokens, totalFooterIdx + 1, 7);
		if (run) {
			grossTotal = run.values[1];
			discount = Math.abs(run.values[2]);
		}
	}

	// Grand Total
	let grandTotal = 0;
	const grandIdx = tokens.findIndex((t) => t.toLowerCase() === "grand total");
	if (grandIdx !== -1) {
		for (let j = grandIdx + 1; j <= grandIdx + 4; j++) {
			const v = parseAmount(tokens[j] ?? "");
			if (v !== null && v > 0) { grandTotal = v; break; }
		}
	}

	// Fallback grandTotal to sum of item totals
	if (!grandTotal) {
		grandTotal = items.reduce((s, i) => s + (i.price ?? 0), 0);
	}

	return { orderId, date, sellerName, items, grossTotal, discount, grandTotal };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseFlipkartMinutesInvoice(pages: string[][]): UnifiedOrder {
	if (!pages.length) throw new Error("PDF has no pages");

	let orderId: string | null = null;
	let date: Date | null = null;
	let sellerName: string | null = null;
	const allItems: OrderItem[] = [];
	let totalGross = 0;
	let totalDiscount = 0;
	let totalGrandTotal = 0;

	for (const tokens of pages) {
		if (isBoilerplatePage(tokens)) continue;
		if (!isInvoicePage(tokens)) continue;

		const result = parseInvoicePage(tokens);

		if (!orderId && result.orderId) orderId = result.orderId;
		if (!date && result.date) date = result.date;
		if (!sellerName && result.sellerName) sellerName = result.sellerName;

		allItems.push(...result.items);
		totalGross += result.grossTotal;
		totalDiscount += result.discount;
		totalGrandTotal += result.grandTotal;
	}

	if (!orderId) {
		throw new Error("Could not find a valid Flipkart Order ID (expected OD...)");
	}

	const itemsTotal = allItems.reduce((s, i) => s + (i.price ?? 0), 0);
	const mrp = totalGross || itemsTotal;
	const productDiscount = Math.max(0, mrp - itemsTotal);

	const rawData: NonNullable<UnifiedOrder["rawData"]> = [
		{ label: "MRP", amount: mrp, isTotal: false },
		...(productDiscount > 0
			? [{ label: "Product discount" as const, amount: -productDiscount, isTotal: false }]
			: []),
		{ label: "Item total", amount: itemsTotal, isTotal: false },
		{ label: "Bill total", amount: totalGrandTotal || itemsTotal, isTotal: true },
	];

	return {
		id: `flipkart-${orderId}`,
		source: "flipkart_minutes",
		placedAt: date ?? new Date(),
		totalAmount: totalGrandTotal || itemsTotal,
		currency: "INR",
		status: "Delivered",
		deliveryLabel: sellerName ?? "Flipkart Minutes",
		items: allItems,
		isManual: true,
		manualImportType: "flipkart-pdf",
		rawData,
	};
}