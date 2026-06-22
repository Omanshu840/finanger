// src/features/orders/adapters/zeptoPdfImportAdapter.ts

import * as pdfjs from "pdfjs-dist";
import type {
	TextItem,
	TextMarkedContent,
} from "pdfjs-dist/types/src/display/api";
import type { OrderItem, UnifiedOrder } from "../types";

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
	return "str" in item;
}

export async function extractTextFromZeptoPdf(file: File): Promise<string[][]> {
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

function parseAmount(token: string): number | null {
	const cleaned = token
		.replace(/₹/g, "")
		.replace(/,/g, "")
		.replace(/^\+\s*/, "")
		.trim();
	const n = parseFloat(cleaned);
	return isNaN(n) ? null : n;
}

function parsePercent(token: string): number | null {
	if (!/%/.test(token)) return null;
	return parseAmount(token.replace(/%/g, ""));
}

function parseDate(token: string): Date | null {
	const patterns: { re: RegExp; order: "dmy" | "ymd" }[] = [
		{ re: /^(\d{2})-(\d{2})-(\d{4})$/, order: "dmy" },
		{ re: /^(\d{2})\/(\d{2})\/(\d{4})$/, order: "dmy" },
		{ re: /^(\d{4})-(\d{2})-(\d{2})$/, order: "ymd" },
	];

	for (const { re, order } of patterns) {
		const match = token.match(re);
		if (!match) continue;

		const [, a, b, c] = match;
		const [day, month, year] =
			order === "dmy"
				? [parseInt(a, 10), parseInt(b, 10) - 1, parseInt(c, 10)]
				: [parseInt(c, 10), parseInt(b, 10) - 1, parseInt(a, 10)];
		const date = new Date(year, month, day, 12, 0, 0);
		if (!isNaN(date.getTime())) return date;
	}

	return null;
}

function findValue(tokens: string[], labelRe: RegExp): string | null {
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		const inline = token.match(labelRe);
		if (inline?.[1]?.trim()) return inline[1].trim();

		if (labelRe.test(`${token} `) && tokens[i + 1]) {
			return tokens[i + 1].trim();
		}
	}

	return null;
}

function extractOrderNo(tokens: string[]): string | null {
	return findValue(tokens, /^Order\s+No\.?:\s*(.+)$/i);
}

function extractSellerName(tokens: string[]): string | null {
	return findValue(tokens, /^Seller\s+Name:\s*(.+)$/i);
}

function extractDate(tokens: string[]): Date | null {
	for (let i = 0; i < tokens.length; i++) {
		const inline = tokens[i].match(/^Date\s*:\s*(\d{2}[-/]\d{2}[-/]\d{4})$/i);
		if (inline) return parseDate(inline[1]);

		if (/^Date\s*:?\s*$/i.test(tokens[i])) {
			for (let j = i + 1; j <= i + 3 && j < tokens.length; j++) {
				const parsed = parseDate(tokens[j]);
				if (parsed) return parsed;
			}
		}
	}

	return null;
}

function extractAmountAfterLabel(tokens: string[], label: string): number | null {
	const labelLower = label.toLowerCase();
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i].toLowerCase() !== labelLower) continue;

		for (let j = i + 1; j <= i + 4 && j < tokens.length; j++) {
			const amount = parseAmount(tokens[j]);
			if (amount !== null) return amount;
		}
	}

	return null;
}

interface ZeptoItemRow {
	item: OrderItem;
	mrp: number;
	discountAmount: number;
	consumedUntil: number;
}

function isHsnToken(token: string): boolean {
	return /^\d{6,10}$/.test(token);
}

function isIntegerAmount(token: string): boolean {
	const amount = parseAmount(token);
	return amount !== null && Number.isInteger(amount);
}

function normalizeItemName(tokens: string[]): string {
	return tokens
		.join(" ")
		.replace(/\s+/g, " ")
		.replace(/\s+([),.])/g, "$1")
		.replace(/([(])\s+/g, "$1")
		.trim();
}

function parseRowAt(tokens: string[], rowStart: number): ZeptoItemRow | null {
	const serial = parseInt(tokens[rowStart], 10);
	if (!Number.isInteger(serial) || serial < 1) return null;

	for (let hsnIdx = rowStart + 3; hsnIdx < tokens.length - 12; hsnIdx++) {
		if (!isHsnToken(tokens[hsnIdx])) continue;

		const mrp = parseAmount(tokens[hsnIdx - 1]);
		const qty = parseAmount(tokens[hsnIdx + 1]);
		const productRate = parseAmount(tokens[hsnIdx + 2]);
		const discountPercent = parsePercent(tokens[hsnIdx + 3]);
		const taxableAmount = parseAmount(tokens[hsnIdx + 4]);
		const cgstRate = parsePercent(tokens[hsnIdx + 5]);
		const sgstRate = parsePercent(tokens[hsnIdx + 6]);
		const cgstAmount = parseAmount(tokens[hsnIdx + 7]);
		const sgstAmount = parseAmount(tokens[hsnIdx + 8]);
		const cessRate = parsePercent(tokens[hsnIdx + 9]);
		let tailIdx = hsnIdx + 10;
		tailIdx += tokens[tailIdx] === "+" ? 2 : 1;
		const cessAmount = parseAmount(tokens[tailIdx]);
		const total = parseAmount(tokens[tailIdx + 1]);

		if (
			mrp === null ||
			qty === null ||
			productRate === null ||
			discountPercent === null ||
			taxableAmount === null ||
			cgstRate === null ||
			sgstRate === null ||
			cgstAmount === null ||
			sgstAmount === null ||
			cessRate === null ||
			cessAmount === null ||
			total === null ||
			!isIntegerAmount(tokens[hsnIdx + 1])
		) {
			continue;
		}

		const nameTokens = tokens.slice(rowStart + 1, hsnIdx - 1);
		const name = normalizeItemName(nameTokens);
		if (!name) continue;

		return {
			item: {
				name,
				quantity: Math.max(1, Math.round(qty)),
				price: total,
				meta: `MRP ₹${mrp.toFixed(2)}`,
			},
			mrp: mrp * Math.max(1, Math.round(qty)),
			discountAmount: Math.max(0, productRate * qty - taxableAmount),
				consumedUntil: tailIdx + 2,
		};
	}

	return null;
}

interface PageResult {
	orderNo: string | null;
	date: Date | null;
	sellerName: string | null;
	items: OrderItem[];
	mrpTotal: number;
	discountTotal: number;
	invoiceValue: number | null;
}

function parsePage(tokens: string[]): PageResult {
	const orderNo = extractOrderNo(tokens);
	const date = extractDate(tokens);
	const sellerName = extractSellerName(tokens);
	const items: OrderItem[] = [];
	let mrpTotal = 0;
	let discountTotal = 0;

	let i = 0;
	while (i < tokens.length) {
		if (/^\d+$/.test(tokens[i])) {
			const row = parseRowAt(tokens, i);
			if (row) {
				items.push(row.item);
				mrpTotal += row.mrp;
				discountTotal += row.discountAmount;
				i = row.consumedUntil;
				continue;
			}
		}

		i++;
	}

	const invoiceValue =
		extractAmountAfterLabel(tokens, "Invoice Value") ??
		extractAmountAfterLabel(tokens, "Item Total");

	return {
		orderNo,
		date,
		sellerName,
		items,
		mrpTotal,
		discountTotal,
		invoiceValue,
	};
}

export function parseZeptoInvoicePages(pages: string[][]): UnifiedOrder {
	if (!pages.length) throw new Error("PDF has no pages");

	let orderNo: string | null = null;
	let date: Date | null = null;
	let sellerName: string | null = null;
	const allItems: OrderItem[] = [];
	let mrpTotal = 0;
	let discountTotal = 0;
	let invoiceTotal = 0;

	for (const tokens of pages) {
		const result = parsePage(tokens);

		if (!orderNo && result.orderNo) orderNo = result.orderNo;
		if (!date && result.date) date = result.date;
		if (!sellerName && result.sellerName) sellerName = result.sellerName;

		allItems.push(...result.items);
		mrpTotal += result.mrpTotal;
		discountTotal += result.discountTotal;
		if (result.invoiceValue !== null) invoiceTotal += result.invoiceValue;
	}

	if (!orderNo) {
		throw new Error("Could not find Zepto Order No. in the PDF");
	}

	if (!allItems.length) {
		throw new Error("No items found - make sure this is a Zepto invoice PDF");
	}

	const itemsTotal = allItems.reduce((sum, item) => sum + (item.price ?? 0), 0);
	const totalAmount = invoiceTotal || itemsTotal;
	const discountFromMrp = Math.max(0, (mrpTotal || itemsTotal) - itemsTotal);
	const roundedDiscount =
		Math.round((discountFromMrp || discountTotal) * 100) / 100;

	const rawData: NonNullable<UnifiedOrder["rawData"]> = [
		{ label: "MRP", amount: mrpTotal || itemsTotal, isTotal: false },
		...(roundedDiscount > 0
			? [
					{
						label: "Product discount" as const,
						amount: -roundedDiscount,
						isTotal: false,
					},
				]
			: []),
		{ label: "Item total", amount: itemsTotal, isTotal: false },
		{ label: "Bill total", amount: totalAmount, isTotal: true },
	];

	return {
		id: `zepto-${orderNo}`,
		source: "zepto",
		placedAt: date ?? new Date(),
		totalAmount,
		currency: "INR",
		status: "Imported manually",
		deliveryLabel: sellerName ?? "Zepto",
		items: allItems,
		rawData,
		isManual: true,
		manualImportType: "zepto-pdf",
	};
}
