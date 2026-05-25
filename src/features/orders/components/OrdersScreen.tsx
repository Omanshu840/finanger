import { useState, useMemo, useEffect } from "react";
import { useOrders } from "../hooks/useOrders";
import { OrderCard } from "./OrderCard";
import { OrderSkeleton } from "./OrderSkeleton";
import { SourceFilterBar } from "./SourceFilterBar";
import type { IntegrationMeta, UnifiedOrder } from "../types";
import { Input } from "@/components/ui/input";
import {
	ShoppingBag,
	Search,
	AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ImportToSplitwiseSheet } from "./ImportToSplitwiseSheet";
import { getManualOrders } from "../storage/manualOrdersStorage";
import { ImportOrdersDropdown } from "./ImportOrdersDropdown";

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
		logoUrl: "https://blinkit.com/images/faviconChange.ico",
		isConnected: getBlinkitConnected(),
		isSupported: true,
	},
	{
		key: "firstclub",
		label: "FirstClub",
		color: "bg-blue-100",
		textColor: "text-blue-700 dark:text-blue-400",
		logoUrl: "https://www.firstclub.site/Logo.png",
		isConnected: true,
		isSupported: true,
	},
	{
		key: "swiggy",
		label: "Swiggy",
		color: "bg-orange-100",
		textColor: "text-orange-700 dark:text-orange-400",
		logoUrl: "https://media-assets.swiggy.com/portal/m/logo_192x192.png",
		isConnected: true,
		isSupported: true,
	},
	// {
	// 	key: "zomato",
	// 	label: "Zomato",
	// 	color: "bg-red-100",
	// 	textColor: "text-red-700 dark:text-red-400",
	// 	logoUrl: "https://www.zomato.com/logo.png",
	// 	isConnected: false,
	// 	isSupported: true,
	// },
	// {
	// 	key: "zepto",
	// 	label: "Zepto",
	// 	color: "bg-purple-100",
	// 	textColor: "text-purple-700 dark:text-purple-400",
	// 	logoUrl: "https://www.zepto.com/logo.png",
	// 	isConnected: false,
	// 	isSupported: true,
	// },
	{
		key: "amazon_now",
		label: "Amazon Now",
		color: "bg-amber-100",
		textColor: "text-amber-700 dark:text-amber-400",
		logoUrl: "https://imgs.search.brave.com/7OQYlmqCNg8ffC6oRGrKk8etMG8IgDovCBMnKjln59o/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9zdGF0/aWMud2lraWEubm9j/b29raWUubmV0L2xv/Z29wZWRpYS9pbWFn/ZXMvMi8yNS9BbWF6/b25fYXBwX2ljb25f/MjAyMF9sYXRlLnN2/Zy9yZXZpc2lvbi9s/YXRlc3Qvc2NhbGUt/dG8td2lkdGgtZG93/bi8yMDA_Y2I9MjAy/MTExMTYxODMyMjM",
		isConnected: true,
		isSupported: true,
	},
	{
		key: "flipkart_minutes",
		label: "Flipkart Minutes",
		color: "bg-indigo-100",
		textColor: "text-indigo-700 dark:text-indigo-400",
		logoUrl: "https://static-assets-web.flixcart.com/batman-returns/batman-returns/p/images/logo_lite-cbb357.png",
		isConnected: true,
		isSupported: true,
	},
];

export default function OrdersScreen() {
	const { orders, loading, errors } = useOrders();
	const [activeFilter, setActiveFilter] = useState<string>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [splitwiseOrder, setSpltwiseOrder] = useState<UnifiedOrder | null>(null);
	const [manualOrders, setManualOrders] = useState<UnifiedOrder[]>([]);

	useEffect(() => {
		setManualOrders(getManualOrders());
	}, []);

	const allOrders = useMemo(() => {
		return [...manualOrders, ...orders].sort(
			(a, b) => b.placedAt.getTime() - a.placedAt.getTime()
		);
	}, [manualOrders, orders]);

	const filteredOrders = useMemo(() => {
		let result = allOrders;

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
	}, [allOrders, activeFilter, searchQuery]);

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

					<ImportOrdersDropdown
						onImported={(order) => {
							setManualOrders((prev) => [order, ...prev]);
						}}
					/>
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