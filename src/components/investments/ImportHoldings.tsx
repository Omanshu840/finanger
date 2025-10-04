import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { type ParsedHolding } from "@/lib/zerodhaParse";
import { mapToYahoo } from "@/lib/tickerMap";
import { fetchQuotes, type QuoteData } from "@/lib/yahoo";
import { formatCurrency } from "@/lib/currency";
import ImportRowCard from "@/components/investments/ImportRowCard";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
    Upload,
    Loader2,
    RefreshCw,
    X,
    ArrowLeft,
    TrendingUp,
    AlertCircle,
} from "lucide-react";
import {
    parseHoldingsWithType,
    type ParsedHoldingWithType,
    type ParsedMFHolding,
    type ParsedEquityHolding,
} from "@/lib/zerodhaParse";
import {
    ensureAMFIIndex,
    type AMFIIndex,
    type AMFIRecord,
    isAMFICached,
    getCacheAge,
    clearAMFICache,
} from "@/lib/amfi";
import { mapMFHoldingToAMFI, computeMFValue } from "@/lib/mfMap";
import MFImportTable, {
    type MFRow,
} from "@/components/investments/MFImportTable";
import { saveAllHoldings, type ImportProgress } from "@/lib/importToDatabase";
import { Progress } from "@/components/ui/progress";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/AuthProvider";

interface HoldingRow extends ParsedHolding {
    id: string;
    mappedTicker: string;
    price: number | null;
    currency: string;
    status: "pending" | "loading" | "success" | "error";
    sourceSymbol: string;
    quantity: number;
    avgPrice: number;
    isin?: string;
}

const CACHE_KEY = "zerodhaImport";

export default function ImportHoldings() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [holdings, setHoldings] = useState<HoldingRow[]>([]);
    const [parsing, setParsing] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [amfiIndex, setAmfiIndex] = useState<AMFIIndex | null>(null);
    const [mfRows, setMFRows] = useState<MFRow[]>([]);
    const [loadingAMFI, setLoadingAMFI] = useState(false);
    const [amfiCacheAge, setAmfiCacheAge] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState<ImportProgress | null>(
        null
    );
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [accountName, setAccountName] = useState("Zerodha");

    // Load from cache on mount
    useEffect(() => {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                setHoldings(data.holdings || []);
            } catch (error) {
                console.error("Failed to load cached data:", error);
            }
        }
    }, []);

    // Save to cache when holdings change
    useEffect(() => {
        if (holdings.length > 0) {
            localStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                    holdings,
                    timestamp: Date.now(),
                })
            );
        }
    }, [holdings]);

    // Update after loading AMFI
    useEffect(() => {
        if (amfiIndex) {
            setAmfiCacheAge(getCacheAge());
        }
    }, [amfiIndex]);

    // Update handleFileSelect:
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setParsing(true);

        try {
            const parsed = await parseHoldingsWithType(selectedFile);

            // Separate equity and MF
            const equities = parsed.filter(
                (h) => h.source === "equity"
            ) as ParsedEquityHolding[];
            const mfs = parsed.filter(
                (h) => h.source === "MF"
            ) as ParsedMFHolding[];

            // Process equities
            const equityRows: HoldingRow[] = equities.map((holding, index) => ({
                ...holding,
                id: `equity-${holding.sourceSymbol}-${index}`,
                mappedTicker: mapToYahoo(holding.sourceSymbol),
                quantity: holding.quantity,
                price: null,
                currency: "INR",
                status: "pending",
                avgPrice: holding.avgPrice
            }));

            setHoldings(equityRows);

            // Process MFs if any
            if (mfs.length > 0) {
                setLoadingAMFI(true);
                try {
                    const index = await ensureAMFIIndex();
                    setAmfiIndex(index);

                    const mfRowsData: MFRow[] = mfs.map((mf, idx) => {
                        const matchResult = mapMFHoldingToAMFI(mf, index);

                        return {
                            id: `mf-${mf.isin || mf.schemeName}-${idx}`,
                            sourceSymbol: mf.sourceSymbol,
                            isin: mf.isin,
                            schemeName: mf.schemeName,
                            units: mf.units,
                            matchType: matchResult.matchType,
                            matched: matchResult.matched,
                            candidates: matchResult.candidates,
                            nav: matchResult.matched?.nav || null,
                            navDate: matchResult.matched?.date || null,
                            avgPrice: mf.avgPrice
                        };
                    });

                    setMFRows(mfRowsData);
                    toast.success(
                        `Parsed ${equityRows.length} equities and ${mfRowsData.length} mutual funds`
                    );
                } catch (error: any) {
                    toast.error("Failed to load AMFI data", {
                        description: error.message,
                    });
                } finally {
                    setLoadingAMFI(false);
                }
            } else {
                toast.success(`Parsed ${equityRows.length} holdings`);
            }
        } catch (error: any) {
            toast.error("Failed to parse file", {
                description: error.message,
            });
        } finally {
            setParsing(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    // Add MF scheme selection handler:
    const handleMFSchemeSelect = (id: string, scheme: AMFIRecord) => {
        setMFRows((prev) =>
            prev.map((row) => {
                if (row.id === id) {
                    return {
                        ...row,
                        matched: scheme,
                        matchType: "manual",
                        nav: scheme.nav,
                        navDate: scheme.date,
                        candidates: undefined,
                    };
                }
                return row;
            })
        );
    };

    // Add refresh AMFI handler (update existing)
    const handleRefreshAMFI = async () => {
        if (mfRows.length === 0) return;

        setLoadingAMFI(true);

        try {
            // Clear in-memory cache and refetch
            clearAMFICache();
            const index = await ensureAMFIIndex();
            setAmfiIndex(index);
            setAmfiCacheAge(getCacheAge());

            // Remap all MFs
            setMFRows((prev) =>
                prev.map((row) => {
                    if (row.matchType === "manual" && row.matched) {
                        const updated =
                            index.byISIN.get(row.matched.isinGrowth || "") ||
                            index.byISIN.get(row.matched.isinReinv || "");
                        if (updated) {
                            return {
                                ...row,
                                nav: updated.nav,
                                navDate: updated.date,
                            };
                        }
                    }
                    return row;
                })
            );

            toast.success("NAV data refreshed");
        } catch (error: any) {
            toast.error("Failed to refresh AMFI data", {
                description: error.message,
            });
        } finally {
            setLoadingAMFI(false);
        }
    };

    // Add save handler
    const handleSaveToPortfolio = async () => {
        if (!user) {
            toast.error("Please log in to save holdings");
            return;
        }

        // Check if we have priced data
        const unpricedEquities = holdings.filter((h) => h.status !== "success");
        const unpricedMFs = mfRows.filter((r) => r.nav == null);

        if (unpricedEquities.length > 0 || unpricedMFs.length > 0) {
            const confirmSave = window.confirm(
                `${
                    unpricedEquities.length + unpricedMFs.length
                } holdings don't have prices. ` +
                    "They will be saved with price as 0. Continue?"
            );
            if (!confirmSave) return;
        }

        setSaving(true);
        setSaveProgress({
            total: holdings.length + mfRows.length,
            completed: 0,
            failed: 0,
            currentItem: "",
        });

        try {
            // Prepare equity data
            const equityData = holdings.map((h) => ({
                holding: {
                    source: "equity" as const,
                    sourceSymbol: h.sourceSymbol,
                    isin: h.isin,
                    quantity: h.quantity,
                    avgPrice: h.avgPrice
                },
                mappedTicker: h.mappedTicker,
            }));

            const mfData = mfRows.map((r) => ({
                holding: {
                    source: "MF" as const,
                    sourceSymbol: r.sourceSymbol,
                    isin: r.isin,
                    schemeName: r.schemeName,
                    units: r.units,
                    avgPrice: r.avgPrice
                },
                matched: r.matched,
            }));

            // Save all holdings
            const result = await saveAllHoldings(
                user.id,
                equityData,
                mfData,
                accountName,
                (progress) => setSaveProgress(progress)
            );

            // Show results
            if (result.errors.length === 0) {
                toast.success("Holdings saved successfully!", {
                    description: `${result.equity.success} equities and ${result.mf.success} mutual funds saved`,
                });

                // Navigate to investments page
                setTimeout(() => {
                    navigate("/investments");
                }, 1500);
            } else {
                toast.warning("Partially saved", {
                    description: `${
                        result.equity.success + result.mf.success
                    } saved, ${result.errors.length} failed`,
                });
                console.error("Save errors:", result.errors);
            }
        } catch (error: any) {
            toast.error("Failed to save holdings", {
                description: error.message,
            });
        } finally {
            setSaving(false);
            setSaveProgress(null);
        }
    };

    const handleFetchPrices = async () => {
        if (holdings.length === 0) return;

        setFetching(true);

        // Mark all as loading
        setHoldings((prev) =>
            prev.map((h) => ({ ...h, status: "loading" as const }))
        );

        try {
            const tickers = holdings.map((h) => h.mappedTicker).filter(Boolean);
            const quotes = await fetchQuotes(tickers);

            setHoldings((prev) =>
                prev.map((holding) => {
                    const quote = quotes[holding.mappedTicker];

                    return {
                        ...holding,
                        price: quote?.price || null,
                        currency: quote?.currency || "INR",
                        status: quote?.price != null ? "success" : "error",
                    };
                })
            );

            const successCount = Object.values(quotes).filter(
                (q) => q.price != null
            ).length;
            toast.success(
                `Fetched prices for ${successCount} of ${tickers.length} holdings`
            );
        } catch (error: any) {
            toast.error("Failed to fetch prices", {
                description: error.message,
            });
            setHoldings((prev) =>
                prev.map((h) => ({ ...h, status: "error" as const }))
            );
        } finally {
            setFetching(false);
        }
    };

    const handleTickerChange = (id: string, newTicker: string) => {
        setHoldings((prev) =>
            prev.map((h) =>
                h.id === id
                    ? {
                          ...h,
                          mappedTicker: newTicker,
                          status: "pending" as const,
                          price: null,
                      }
                    : h
            )
        );
    };

    const handleRetryFailed = async () => {
        const failedHoldings = holdings.filter((h) => h.status === "error");
        if (failedHoldings.length === 0) return;

        setFetching(true);

        // Mark failed as loading
        setHoldings((prev) =>
            prev.map((h) =>
                h.status === "error" ? { ...h, status: "loading" as const } : h
            )
        );

        try {
            const tickers = failedHoldings
                .map((h) => h.mappedTicker)
                .filter(Boolean);
            const quotes = await fetchQuotes(tickers);

            setHoldings((prev) =>
                prev.map((holding) => {
                    if (holding.status !== "loading") return holding;

                    const quote = quotes[holding.mappedTicker];
                    return {
                        ...holding,
                        price: quote?.price || null,
                        currency: quote?.currency || "INR",
                        status: quote?.price != null ? "success" : "error",
                    };
                })
            );

            toast.success("Retried failed holdings");
        } catch (error: any) {
            toast.error("Retry failed", {
                description: error.message,
            });
        } finally {
            setFetching(false);
        }
    };

    const handleClear = () => {
        setHoldings([]);
        setFile(null);
        localStorage.removeItem(CACHE_KEY);
        toast.info("Cleared import data");
    };

    // Calculate totals (update existing):
    const equityValue = holdings.reduce((sum, h) => {
        if (h.status === "success" && h.price != null) {
            return sum + h.quantity * h.price;
        }
        return sum;
    }, 0);

    const mfValue = mfRows.reduce((sum, row) => {
        if (row.nav != null) {
            return sum + computeMFValue(row.units, row.nav);
        }
        return sum;
    }, 0);

    const totalValue = equityValue + mfValue;

    const successCount = holdings.filter((h) => h.status === "success").length;
    const errorCount = holdings.filter((h) => h.status === "error").length;
    const pendingCount = holdings.filter((h) => h.status === "pending").length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate("/investments")}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Import Holdings</h1>
                        <p className="text-sm text-muted-foreground">
                            Upload Zerodha Console CSV/XLSX
                        </p>
                    </div>
                </div>
            </div>

            {/* File Upload */}
            {holdings.length === 0 && (
                <Card>
                    <CardContent className="p-6">
                        <div className="text-center space-y-4">
                            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <Upload className="h-6 w-6 text-primary" />
                            </div>

                            <div>
                                <h3 className="font-semibold mb-1">
                                    Upload Holdings File
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    CSV or XLSX format from Zerodha Console
                                </p>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={parsing}
                                className="w-full sm:w-auto"
                            >
                                {parsing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Parsing...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Choose File
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Summary */}
            {holdings.length > 0 && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Value</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">
                                    {formatCurrency(totalValue, "INR")}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Holdings</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">
                                    {holdings.length}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {successCount} priced, {errorCount} failed
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Status</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2">
                                    {successCount > 0 && (
                                        <span className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-1 rounded">
                                            {successCount} OK
                                        </span>
                                    )}
                                    {errorCount > 0 && (
                                        <span className="text-xs bg-red-500/10 text-red-700 dark:text-red-400 px-2 py-1 rounded">
                                            {errorCount} Error
                                        </span>
                                    )}
                                    {pendingCount > 0 && (
                                        <span className="text-xs bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded">
                                            {pendingCount} Pending
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    {/* Actions */}
                    <div className="flex flex-wrap gap-3">
                        <Button
                            onClick={handleFetchPrices}
                            disabled={fetching || pendingCount === 0}
                        >
                            {fetching ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Fetching...
                                </>
                            ) : (
                                <>
                                    <TrendingUp className="mr-2 h-4 w-4" />
                                    Fetch Prices
                                </>
                            )}
                        </Button>

                        {errorCount > 0 && (
                            <Button
                                variant="outline"
                                onClick={handleRetryFailed}
                                disabled={fetching}
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Retry Failed ({errorCount})
                            </Button>
                        )}

                        {holdings.length > 0 && (
                            <Button
                                onClick={() => setShowSaveDialog(true)}
                                disabled={saving}
                                variant="default"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save to Portfolio"
                                )}
                            </Button>
                        )}

                        {/* Save Progress */}
                        {saveProgress && (
                            <Card>
                                <CardContent className="p-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>Saving holdings...</span>
                                            <span className="font-medium">
                                                {saveProgress.completed} /{" "}
                                                {saveProgress.total}
                                            </span>
                                        </div>
                                        <Progress
                                            value={
                                                (saveProgress.completed /
                                                    saveProgress.total) *
                                                100
                                            }
                                            className="h-2"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Current: {saveProgress.currentItem}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={parsing}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            Upload New File
                        </Button>

                        <Button variant="ghost" onClick={handleClear}>
                            <X className="mr-2 h-4 w-4" />
                            Clear
                        </Button>
                    </div>
                    {/* Yahoo API Notice */}
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Prices are fetched from Yahoo Finance (unofficial
                            API). Rate limits apply. Manual ticker mapping may
                            be needed for some securities.
                        </AlertDescription>
                    </Alert>
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            <div className="space-y-1">
                                <p>
                                    NAV data fetched from AMFI (official
                                    source). Data is cached in memory for 24
                                    hours.
                                </p>
                                {amfiCacheAge != null && (
                                    <p className="text-xs text-muted-foreground">
                                        Cache age: {amfiCacheAge} minutes
                                    </p>
                                )}
                            </div>
                        </AlertDescription>
                    </Alert>
                    {/* Holdings List */}
                    <div className="space-y-3">
                        {holdings.map((holding) => (
                            <ImportRowCard
                                key={holding.id}
                                sourceSymbol={holding.sourceSymbol}
                                mappedTicker={holding.mappedTicker}
                                quantity={holding.quantity}
                                price={holding.price}
                                currency={holding.currency}
                                status={holding.status}
                                onTickerChange={(newTicker) =>
                                    handleTickerChange(holding.id, newTicker)
                                }
                            />
                        ))}
                    </div>
                    {mfRows.length > 0 && (
                        <>
                            <Card>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardDescription>
                                            Mutual Funds Value
                                        </CardDescription>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleRefreshAMFI}
                                            disabled={loadingAMFI}
                                        >
                                            {loadingAMFI ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">
                                        {formatCurrency(mfValue, "INR")}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {
                                            mfRows.filter((r) => r.nav != null)
                                                .length
                                        }{" "}
                                        of {mfRows.length} valued
                                    </p>
                                </CardContent>
                            </Card>

                            <div>
                                <h2 className="text-lg font-semibold mb-4">
                                    Mutual Funds
                                </h2>
                                <MFImportTable
                                    rows={mfRows}
                                    onSchemeSelect={handleMFSchemeSelect}
                                />
                            </div>
                        </>
                    )}

                    {/* Save Confirmation Dialog */}
                    <Dialog
                        open={showSaveDialog}
                        onOpenChange={setShowSaveDialog}
                    >
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    Save Holdings to Portfolio
                                </DialogTitle>
                                <DialogDescription>
                                    This will create assets and transactions in
                                    your portfolio.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="account-name">
                                        Account Name
                                    </Label>
                                    <Input
                                        id="account-name"
                                        value={accountName}
                                        onChange={(e) =>
                                            setAccountName(e.target.value)
                                        }
                                        placeholder="Zerodha"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        A portfolio account will be created with
                                        this name if it doesn't exist
                                    </p>
                                </div>

                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        <div className="space-y-1 text-sm">
                                            <p className="font-medium">
                                                What will be saved:
                                            </p>
                                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                                <li>
                                                    {holdings.length} equity
                                                    holdings (quantities only)
                                                </li>
                                                <li>
                                                    {mfRows.length} mutual fund
                                                    holdings (units only)
                                                </li>
                                                <li>
                                                    BUY transactions for each
                                                    holding
                                                </li>
                                                <li>
                                                    <strong>
                                                        Prices will be fetched
                                                        live
                                                    </strong>{" "}
                                                    when viewing portfolio
                                                </li>
                                            </ul>
                                        </div>
                                    </AlertDescription>
                                </Alert>

                                {(holdings.some(
                                    (h) => h.status !== "success"
                                ) ||
                                    mfRows.some((r) => r.nav == null)) && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            Some holdings don't have prices and
                                            will be saved with price = 0. You
                                            can update prices later.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>

                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setShowSaveDialog(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => {
                                        setShowSaveDialog(false);
                                        handleSaveToPortfolio();
                                    }}
                                    disabled={saving}
                                >
                                    Save to Portfolio
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </div>
    );
}
