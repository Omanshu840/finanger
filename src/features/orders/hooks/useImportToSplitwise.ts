import { useState } from "react";
import { splitwiseClient } from "@/features/splitwise/api/splitwiseApi";
import {
	fetchBlinkitOrderDetail,
} from "../adapters/blinkitDetailAdapter";
import type { SplitwiseGroup } from "@/features/splitwise/api/splitwiseApi";
import { INTEGRATION_LABELS, type DetailedOrderItem, type OrderDetail, type UnifiedOrder } from "../types";
import { toast } from "sonner";

export interface LineItemSplit {
	item: DetailedOrderItem | { id: string; label: string; price: number };
	memberIds: number[];   // which group members share this line item
}

export interface ImportState {
	step: "idle" | "loading_details" | "select_group" | "split_items" | "submitting" | "done";
	orderDetail: OrderDetail | null;
	groups: SplitwiseGroup[];
	selectedGroup: SplitwiseGroup | null;
	currentUserId: number | null;
	splits: LineItemSplit[];
	error: string | null;
}

function getBlinkitToken(): string | null {
	try {
		return JSON.parse(localStorage.getItem("blinkit_auth") ?? "")?.accessToken ?? null;
	} catch { return null; }
}

// cartId is encoded in order.id as "order_{orderId}_{cartId}"
function parseOrderAndCartId(rawId: string): { orderId: string; cartId: string } {
	const parts = rawId.replace("order_", "").split("_");
	return { orderId: parts[0], cartId: parts[1] ?? "" };
}

export function useImportToSplitwise() {
	const [state, setState] = useState<ImportState>({
		step: "idle",
		orderDetail: null,
		groups: [],
		selectedGroup: null,
		currentUserId: null,
		splits: [],
		error: null,
	});

	const startImport = async (order: UnifiedOrder) => {
		setState((s) => ({ ...s, step: "loading_details", error: null }));
		try {
			let orderDetail: OrderDetail;

			if (order.source === "blinkit") {
				const token = getBlinkitToken();
				if (!token) throw new Error("Blinkit not connected");

				const { orderId, cartId } = parseOrderAndCartId(order.id);
				orderDetail = await fetchBlinkitOrderDetail(token, orderId, cartId, order.placedAt.toDateString());
			} else {
				orderDetail = {
					source: order.source,
					orderId: order.id,
					orderDate: order.placedAt.toDateString(),
					cartId: "",
					items: order.items.map((i, idx) => ({
						id: String(idx),
						name: i.name,
						quantity: String(i.quantity),
						price: i.price ?? 0,
						imageUrl: i.imageUrl,
					})),
					billLines: order.rawData?.map((d) => ({
						label: d.label,
						amount: d.amount,
						isTotal: d.isTotal,
					})) ?? [],
					totalAmount: order.totalAmount ?? 0,
					currency: order.currency,
					deliveryLabel: order.deliveryLabel,
					rawData: order.rawData,
				} as OrderDetail;
			}

			const [groups, currentUser] = await Promise.all([
				splitwiseClient.getGroups(),
				splitwiseClient.getCurrentUser(),
			]);

			// Build default splits — all items assigned to everyone
			const allLineItems = buildAllLineItems(orderDetail);
			const splits: LineItemSplit[] = allLineItems.map((item) => ({
				item,
				memberIds: [],   // empty = not yet assigned, UI will default to all members
			}));

			setState((s) => ({
				...s,
				step: "select_group",
				orderDetail,
				groups,
				currentUserId: currentUser.id,
				splits,
			}));
		} catch (err: any) {
			setState((s) => ({ ...s, step: "idle", error: err.message }));
			toast.error("Failed to load order details", { description: err.message });
		}
	};

	const selectGroup = (group: SplitwiseGroup) => {
		// Default: assign all members to all line items
		setState((s) => ({
			...s,
			step: "split_items",
			selectedGroup: group,
			splits: s.splits.map((split) => ({
				...split,
				memberIds: group.members.map((m) => m.id),
			})),
		}));
	};

	const toggleMemberOnItem = (itemId: string, memberId: number) => {
		setState((s) => ({
			...s,
			splits: s.splits.map((split) => {
				if (split.item.id !== itemId) return split;
				const has = split.memberIds.includes(memberId);
				return {
					...split,
					memberIds: has
						? split.memberIds.filter((id) => id !== memberId)
						: [...split.memberIds, memberId],
				};
			}),
		}));
	};

	const submitToSplitwise = async () => {
		const { selectedGroup, splits, currentUserId, orderDetail } = state;
		if (!selectedGroup || !currentUserId || !orderDetail) return;

		setState((s) => ({ ...s, step: "submitting" }));

		try {
			// ── 1. Build per-member totals ──────────────────────────────────────
			const memberTotals: Record<number, number> = {};

			for (const split of splits) {
				if (split.memberIds.length === 0) continue;
				const share = split.item.price / split.memberIds.length;
				for (const memberId of split.memberIds) {
					memberTotals[memberId] = (memberTotals[memberId] ?? 0) + share;
				}
			}

			const totalCost = Object.values(memberTotals).reduce((s, v) => s + v, 0);

			// ── 2. Build Splitwise users array ─────────────────────────────────
			const users = Object.entries(memberTotals).map(([memberId, owedAmount]) => ({
				user_id: Number(memberId),
				paid_share:
					Number(memberId) === currentUserId ? totalCost.toFixed(2) : "0.00",
				owed_share: owedAmount.toFixed(2),
			}));

			// ── 3. Build detailed notes ────────────────────────────────────────
			const memberNameMap: Record<number, string> = {};
			for (const m of selectedGroup.members) {
				memberNameMap[m.id] = m.first_name;
			}

			const itemLines = splits
				.filter((s) => s.memberIds.length > 0)
				.map((split) => {
					const names = split.memberIds
						.map((id) => memberNameMap[id] ?? `User ${id}`)
						.join(", ");
					const perPerson = (split.item.price / split.memberIds.length).toFixed(2);
					return `• ${(split.item as any).label}: ₹${split.item.price.toFixed(0)} ÷ ${split.memberIds.length} (${names}) = ₹${perPerson} each`;
				});

			const splitSummaryLines = Object.entries(memberTotals).map(
				([memberId, amount]) =>
					`  ${memberNameMap[Number(memberId)] ?? `User ${memberId}`}: ₹${amount.toFixed(2)}`
			);

			const notes = [
				`${INTEGRATION_LABELS[orderDetail.source || "blinkit"]} Order #${orderDetail.orderId}`,
				``,
				`Items:`,
				...itemLines,
				``,
				`Final split:`,
				...splitSummaryLines,
				``,
				`Total: ₹${totalCost.toFixed(2)}`,
			].join("\n");

			// ── 4. Resolve date — use order date if available ──────────────────
			const expenseDate = orderDetail.orderDate
				? new Date(orderDetail.orderDate).toISOString()
				: new Date().toISOString();

			// ── 5. Create expense ──────────────────────────────────────────────
			await splitwiseClient.createExpense({
				cost: totalCost.toFixed(2),
				description: `${INTEGRATION_LABELS[orderDetail.source || "blinkit"]} #${orderDetail.orderId}`,
				details: notes,          // ← Splitwise "notes" field
				date: expenseDate,       // ← order date, not today
				group_id: selectedGroup.id,
				currency_code: "INR",
				users,
			});

			setState((s) => ({ ...s, step: "done" }));
			toast.success("Expense added to Splitwise!", {
				description: `₹${totalCost.toFixed(2)} split across ${selectedGroup.name}`,
			});
		} catch (err: any) {
			setState((s) => ({ ...s, step: "split_items", error: err.message }));
			toast.error("Failed to create expense", { description: err.message });
		}
	};

	const reset = () => setState({
		step: "idle", orderDetail: null, groups: [], selectedGroup: null,
		currentUserId: null, splits: [], error: null,
	});

	return { state, startImport, selectGroup, toggleMemberOnItem, submitToSplitwise, reset };
}

// Combine product items + charge bill lines into a flat list
function buildAllLineItems(detail: OrderDetail) {
	const productItems = detail.items.map((item) => ({
		id: item.id,
		label: item.name,
		price: item.price,
		imageUrl: item.imageUrl,
		quantity: item.quantity,
	}));

	const chargeLines = detail.billLines
		.filter((b) => !b.isTotal && b.amount > 0 && !b.label.toLowerCase().includes("mrp") && !b.label.toLowerCase().includes("item total"))
		.map((b, idx) => ({
			id: `charge_${idx}`,
			label: b.label,
			price: b.amount,
			imageUrl: undefined,
			quantity: undefined,
		}));

	return [...productItems, ...chargeLines];
}