import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { listTransactions, listPortfolioAccounts } from "@/data/investments";
import { computeHoldings, computeInvestedAmount } from "@/lib/holdings";
import { formatCurrency } from "@/lib/currency";
import AccountSelector from "@/components/investments/AccountSelector";
import HoldingsList from "@/components/investments/HoldingsList";
import TransactionForm from "@/components/investments/TransactionForm";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import { toast } from "sonner";
import { Plus, Loader2, TrendingUp, Wallet, Upload } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
    enrichHoldingsWithPrices,
    type HoldingWithPrice,
} from "@/lib/liveValuation";
import { cn } from "@/lib/utils";

export default function Investments() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>();
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const isDesktop = useMediaQuery("(min-width: 768px)");
    // Update state
    const [enrichedHoldings, setEnrichedHoldings] = useState<
        HoldingWithPrice[]
    >([]);
    const [fetchingPrices, setFetchingPrices] = useState(false);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user, selectedAccountId, refreshTrigger]);

    // Keyboard shortcut: 't' to add transaction
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            ) {
                return;
            }

            if (e.key === "t" && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                setIsFormOpen(true);
            }
        };

        window.addEventListener("keydown", handleKeyPress);
        return () => window.removeEventListener("keydown", handleKeyPress);
    }, []);

    // Update loadData function
    const loadData = async () => {
        setLoading(true);

        try {
            const [txData, accountsData] = await Promise.all([
                listTransactions({ accountId: selectedAccountId }),
                listPortfolioAccounts(),
            ]);

            setTransactions(txData);
            setAccounts(accountsData);

            // Compute holdings from transactions
            const holdings = computeHoldings(
                txData,
                new Map(
                    txData
                        .filter((tx) => tx.asset)
                        .map((tx) => [
                            tx.asset.id,
                            { symbol: tx.asset.symbol, name: tx.asset.name },
                        ])
                )
            );

            // Separate equity and MF
            const equityHoldings = holdings.filter((h) => {
                const asset = txData.find(
                    (tx) => tx.asset?.id === h.asset_id
                )?.asset;
                return asset?.asset_type === "stock";
            });

            const mfHoldings = holdings.filter((h) => {
                const asset = txData.find(
                    (tx) => tx.asset?.id === h.asset_id
                )?.asset;
                return asset?.asset_type === "mutual_fund";
            });

            // Build ticker and ISIN maps
            const equityTickerMap = new Map<string, string>();
            const mfIsinMap = new Map<string, string>();

            for (const tx of txData) {
                if (!tx.asset) continue;

                if (tx.asset.asset_type === "stock") {
                    // Get yahoo ticker from metadata or construct from symbol
                    const ticker =
                        tx.asset.metadata?.yahoo_ticker ||
                        `${tx.asset.symbol}.NS`;
                    equityTickerMap.set(tx.asset.id, ticker);
                } else if (
                    tx.asset.asset_type === "mutual_fund" &&
                    tx.asset.isin
                ) {
                    mfIsinMap.set(tx.asset.id, tx.asset.isin);
                }
            }

            // Fetch live prices
            setFetchingPrices(true);
            const enriched = await enrichHoldingsWithPrices(
                equityHoldings,
                mfHoldings,
                equityTickerMap,
                mfIsinMap
            );
            setEnrichedHoldings(enriched);
            setFetchingPrices(false);
        } catch (error: any) {
            toast.error("Failed to load investments", {
                description: error.message,
            });
        } finally {
            setLoading(false);
        }
    };

    // Update summary calculation
    const summary = useMemo(() => {
        const totalInvested = enrichedHoldings.reduce(
            (sum, h) => sum + h.costBasis,
            0
        );
        const totalMarketValue = enrichedHoldings.reduce(
            (sum, h) => sum + (h.marketValue || 0),
            0
        );
        const totalPnL = enrichedHoldings.reduce(
            (sum, h) => sum + (h.unrealizedPnL || 0),
            0
        );
        const totalPnLPct =
            totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

        return {
            invested: totalInvested,
            currentValue: totalMarketValue,
            unrealizedPnL: totalPnL,
            unrealizedPnLPct: totalPnLPct,
            holdingCount: enrichedHoldings.length,
        };
    }, [enrichedHoldings]);

    // Compute holdings
    const holdings = computeHoldings(
        transactions,
        new Map(
            transactions
                .filter((tx) => tx.asset)
                .map((tx) => [
                    tx.asset.id,
                    { symbol: tx.asset.symbol, name: tx.asset.name },
                ])
        )
    );

    const investedAmount = computeInvestedAmount(transactions);

    const handleHoldingClick = (assetId: string) => {
        navigate(`/investments/asset/${assetId}`);
    };

    const handleFormSuccess = () => {
        setIsFormOpen(false);
        setRefreshTrigger((prev) => prev + 1);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Investments
                    </h1>
                    <p className="text-muted-foreground">
                        Track your portfolio and transactions
                    </p>
                </div>

                <Button onClick={() => setIsFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Transaction
                    <kbd className="ml-2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                        T
                    </kbd>
                </Button>
            </div>

            {/* Account Selector */}
            <AccountSelector
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onAccountChange={setSelectedAccountId}
            />

            {/* Summary Cards */}
            {!loading && transactions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Total Invested
                            </CardTitle>
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatCurrency(investedAmount, "INR")}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Cost basis of open positions
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Holdings
                            </CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {holdings.length}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Active positions
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Button
                onClick={() => navigate("/investments/import")}
                variant="outline"
            >
                <Upload className="mr-2 h-4 w-4" />
                Import Holdings
            </Button>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}

            {/* Empty State */}
            {!loading && transactions.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                        No investments yet
                    </h3>
                    <p className="text-muted-foreground mb-4">
                        Start tracking your portfolio by adding your first
                        transaction
                    </p>
                    <Button onClick={() => setIsFormOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add First Transaction
                    </Button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Invested
                        </CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(summary.invested, "INR")}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Cost basis
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Current Value
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(summary.currentValue, "INR")}
                        </div>
                        {fetchingPrices && (
                            <p className="text-xs text-muted-foreground mt-1">
                                <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
                                Fetching prices...
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total P&L
                        </CardTitle>
                        <TrendingUp
                            className={cn(
                                "h-4 w-4",
                                summary.unrealizedPnL >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                            )}
                        />
                    </CardHeader>
                    <CardContent>
                        <div
                            className={cn(
                                "text-2xl font-bold",
                                summary.unrealizedPnL >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                            )}
                        >
                            {formatCurrency(summary.unrealizedPnL, "INR")}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {summary.unrealizedPnLPct.toFixed(2)}%{" "}
                            {summary.unrealizedPnL >= 0 ? "gain" : "loss"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Holdings List */}
            {!loading && holdings.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold mb-4">Holdings</h2>
                    <HoldingsList
                        holdings={enrichedHoldings}
                        onHoldingClick={handleHoldingClick}
                        showPrices={true}
                    />
                </div>
            )}

            {/* Transaction Form - Mobile (Drawer) */}
            {!isDesktop && (
                <Drawer open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DrawerContent className="h-[90vh] overflow-y-auto">
                        <DrawerHeader>
                            <DrawerTitle>Add Transaction</DrawerTitle>
                        </DrawerHeader>
                        <div className="p-4">
                            <TransactionForm
                                onSuccess={handleFormSuccess}
                                onCancel={() => setIsFormOpen(false)}
                                preselectedAccountId={selectedAccountId}
                            />
                        </div>
                    </DrawerContent>
                </Drawer>
            )}

            {/* Transaction Form - Desktop (Dialog) */}
            {isDesktop && (
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Add Transaction</DialogTitle>
                        </DialogHeader>
                        <div className="mt-4">
                            <TransactionForm
                                onSuccess={handleFormSuccess}
                                onCancel={() => setIsFormOpen(false)}
                                preselectedAccountId={selectedAccountId}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
