import { useState, useMemo } from "react";
import { useOrders } from "../hooks/useOrders";
import { OrderCard } from "./OrderCard";
import { OrderSkeleton } from "./OrderSkeleton";
import { SourceFilterBar } from "./SourceFilterBar";
import type { IntegrationMeta, UnifiedOrder } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	RefreshCw,
	ShoppingBag,
	Search,
	AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TooltipProvider } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ImportToSplitwiseSheet } from "./ImportToSplitwiseSheet";

function getBlinkitConnected(): boolean {
	try {
		const raw = localStorage.getItem("blinkit_auth");
		return !!JSON.parse(raw ?? "")?.accessToken;
	} catch {
		return false;
	}
}

const INTEGRATION_META: IntegrationMeta[] = [
	{
		key: "blinkit",
		label: "Blinkit",
		color: "bg-yellow-100",
		textColor: "text-yellow-700 dark:text-yellow-400",
		emoji: "🛒",
		isConnected: getBlinkitConnected(),
		isSupported: true,
	},
	{
		key: "swiggy",
		label: "Swiggy",
		color: "bg-orange-100",
		textColor: "text-orange-700 dark:text-orange-400",
		emoji: "🍜",
		isConnected: false,
		isSupported: true,
	},
	{
		key: "zomato",
		label: "Zomato",
		color: "bg-red-100",
		textColor: "text-red-700 dark:text-red-400",
		emoji: "🍕",
		isConnected: false,
		isSupported: true,
	},
	{
		key: "zepto",
		label: "Zepto",
		color: "bg-purple-100",
		textColor: "text-purple-700 dark:text-purple-400",
		emoji: "⚡",
		isConnected: false,
		isSupported: true,
	},
	{
		key: "firstclub",
		label: "FirstClub",
		color: "bg-blue-100",
		textColor: "text-blue-700 dark:text-blue-400",
		emoji: "🏪",
		isConnected: false,
		isSupported: false,
	},
	{
		key: "amazon_now",
		label: "Amazon Now",
		color: "bg-amber-100",
		textColor: "text-amber-700 dark:text-amber-400",
		emoji: "📦",
		isConnected: false,
		isSupported: false,
	},
	{
		key: "flipkart_minutes",
		label: "Flipkart Minutes",
		color: "bg-indigo-100",
		textColor: "text-indigo-700 dark:text-indigo-400",
		emoji: "🚀",
		isConnected: false,
		isSupported: false,
	},
];

export default function OrdersScreen() {
	const { orders, loading, errors, lastFetched, refetch } = useOrders();
	const [activeFilter, setActiveFilter] = useState<string>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [splitwiseOrder, setSpltwiseOrder] = useState<UnifiedOrder | null>(null);

	const filteredOrders = useMemo(() => {
		let result = orders;

		if (activeFilter !== "all") {
			result = result.filter((o) => o.source === activeFilter);
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(o) =>
					o.items.some((i) => i.name.toLowerCase().includes(q)) ||
					o.source.toLowerCase().includes(q) ||
					o.id.toLowerCase().includes(q)
			);
		}

		return result;
	}, [orders, activeFilter, searchQuery]);

	const connectedCount = INTEGRATION_META.filter((m) => m.isConnected).length;

	const handleImportToSplitwise = (order: UnifiedOrder) => {
		setSpltwiseOrder(order);
	};

	const errorEntries = Object.entries(errors);

	return (
		<TooltipProvider delayDuration={300}>
			<div className="mx-auto max-w-4xl space-y-6">
				{/* Page header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-1">
						<h1 className="text-3xl font-bold tracking-tight">Orders</h1>
						<p className="text-muted-foreground">
							{connectedCount === 0
								? "Connect integrations in Profile to see your orders here"
								: `Orders from ${connectedCount} connected integration${connectedCount !== 1 ? "s" : ""}`}
						</p>
					</div>

					<div className="flex shrink-0 items-center gap-2">
						{lastFetched && (
							<span className="text-xs text-muted-foreground">
								Updated {format(lastFetched, "h:mm a")}
							</span>
						)}
						<Button
							variant="outline"
							size="sm"
							onClick={refetch}
							disabled={loading}
							className="gap-1.5"
						>
							<RefreshCw
								className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
							/>
							Refresh
						</Button>
					</div>
				</div>

				{/* Errors */}
				{errorEntries.length > 0 && (
					<div className="space-y-2">
						{errorEntries.map(([source, message]) => (
							<Alert key={source} variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>
									<span className="font-medium capitalize">{source}:</span>{" "}
									{message}
								</AlertDescription>
							</Alert>
						))}
					</div>
				)}

				{/* Source filter bar */}
				<SourceFilterBar
					integrations={INTEGRATION_META}
					activeFilter={activeFilter}
					onFilterChange={setActiveFilter}
				/>

				{/* Search */}
				<div className="relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search by item name, order ID..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>

				{/* Orders list */}
				{loading ? (
					<div className="space-y-3">
						{Array.from({ length: 4 }).map((_, i) => (
							<OrderSkeleton key={i} />
						))}
					</div>
				) : connectedCount === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
						<div className="mb-4 rounded-full border bg-muted/40 p-4">
							<ShoppingBag className="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 className="font-semibold">No integrations connected</h3>
						<p className="mt-1 max-w-xs text-sm text-muted-foreground">
							Go to <span className="font-medium">Profile → Integrations</span> to
							connect Blinkit, Swiggy, or other apps and see your orders here.
						</p>
					</div>
				) : filteredOrders.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
						<ShoppingBag className="mb-3 h-8 w-8 text-muted-foreground" />
						<h3 className="font-semibold">No orders found</h3>
						<p className="mt-1 text-sm text-muted-foreground">
							{searchQuery
								? "Try a different search term"
								: "No orders yet for this filter"}
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{filteredOrders.map((order) => {
							const meta =
								INTEGRATION_META.find((m) => m.key === order.source) ??
								INTEGRATION_META[0];
							return (
								<OrderCard
									key={`${order.source}-${order.id}`}
									order={order}
									meta={meta}
									onImportToSplitwise={handleImportToSplitwise}
								/>
							);
						})}
					</div>
				)}
			</div>
			<ImportToSplitwiseSheet
				order={splitwiseOrder}
				open={!!splitwiseOrder}
				onClose={() => setSpltwiseOrder(null)}
			/>
		</TooltipProvider>
	);
}