import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearSwiggySession, fetchSwiggyOrders, getSwiggySession, requestSwiggyOtp, verifySwiggyOtp, type SwiggySession } from "@/lib/swiggy";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function SwiggyIntegration() {
    const [session, setSession] = useState<SwiggySession | null>(null);
    const [mobile, setMobile] = useState("");
    const [otp, setOtp] = useState("");
    const [status, setStatus] = useState<"idle" | "otpSent" | "connected">
        ("idle");
    const [loading, setLoading] = useState(false);
    const [ordersCount, setOrdersCount] = useState<number | null>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [fetchingOrders, setFetchingOrders] = useState(false);

    useEffect(() => {
        const saved = getSwiggySession();
        if (saved) {
            setSession(saved);
            setMobile(saved.mobile);
            setStatus("connected");
        }
    }, []);

    const handleSendOtp = async () => {
        if (!mobile.match(/^[0-9]{10}$/)) {
            toast.error("Enter a valid 10-digit mobile number.");
            return;
        }

        setLoading(true);
        try {
            const response = await requestSwiggyOtp(mobile);
            if (response?.statusCode === 0 || response?.statusCode === 2) {
                toast.success("OTP sent to your Swiggy number.");
                setStatus("otpSent");
            } else {
                throw new Error(response?.statusMessage || "Failed to send OTP.");
            }
        } catch (error: any) {
            console.error("Swiggy OTP request failed:", error);
            toast.error("Failed to send OTP.", {
                description: error?.message ?? "Please try again.",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp.trim()) {
            toast.error("Enter the OTP sent to your mobile.");
            return;
        }

        setLoading(true);
        try {
            const session = await verifySwiggyOtp(otp.trim());
            setSession(session);
            setStatus("connected");
            setOtp("");
            setOrders([]);
            setOrdersCount(null);
            toast.success("Swiggy account connected.");
        } catch (error: any) {
            console.error("Swiggy OTP verify failed:", error);
            toast.error("Unable to verify OTP.", {
                description: error?.message ?? "Please try again.",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleFetchOrders = async () => {
        if (!session) {
            toast.error("Connect your Swiggy account first.");
            return;
        }

        setFetchingOrders(true);
        try {
            const response = await fetchSwiggyOrders(session);
            const orderList = response?.data?.orders ?? [];
            const totalOrders =
                response?.data?.total_orders ?? orderList.length ?? 0;
            setOrders(orderList);
            setOrdersCount(totalOrders);
            toast.success("Swiggy orders fetched.");
        } catch (error: any) {
            console.error("Fetch Swiggy orders failed:", error);
            toast.error("Failed to fetch Swiggy orders.", {
                description: error?.message ?? "Please reconnect and try again.",
            });
        } finally {
            setFetchingOrders(false);
        }
    };

    const handleDisconnect = () => {
        clearSwiggySession();
        setSession(null);
        setStatus("idle");
        setOtp("");
        setOrders([]);
        setOrdersCount(null);
        toast("Swiggy disconnected.");
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Swiggy Integration</CardTitle>
                <CardDescription>
                    Connect Swiggy with OTP and store a session token for order
                    sync.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {session ? (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-border bg-muted p-4">
                            <p className="text-sm text-muted-foreground">
                                Connected as
                            </p>
                            <p className="font-medium">{session.mobile}</p>
                            {session.customerId ? (
                                <p className="text-sm text-muted-foreground">
                                    Swiggy customer ID: {session.customerId}
                                </p>
                            ) : null}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                            <Button
                                onClick={handleFetchOrders}
                                disabled={fetchingOrders}
                            >
                                {fetchingOrders ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Fetch Swiggy Orders
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={handleDisconnect}
                            >
                                Disconnect Swiggy
                            </Button>
                        </div>

                        {ordersCount !== null ? (
                            <div className="rounded-lg border border-border bg-background p-4">
                                <p className="text-sm text-muted-foreground">
                                    Orders returned: {ordersCount}
                                </p>
                                {orders.length > 0 ? (
                                    <div className="mt-3 space-y-2 text-sm">
                                        {orders.slice(0, 3).map((order) => (
                                            <div
                                                key={order.order_id}
                                                className="rounded-lg border border-border p-3"
                                            >
                                                <p className="font-medium">
                                                    Order #{order.order_id}
                                                </p>
                                                <p className="text-muted-foreground">
                                                    {order.restaurant_name} · {order.order_status}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No order details available yet.
                                    </p>
                                )}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label className="text-sm font-medium">
                                Mobile number
                            </Label>
                            <Input
                                value={mobile}
                                onChange={(event) => setMobile(event.target.value)}
                                placeholder="Enter your 10-digit Swiggy mobile"
                                maxLength={10}
                            />
                            <p className="text-sm text-muted-foreground">
                                Swiggy uses OTP-based login for account linking.
                            </p>

                            <Button
                                onClick={handleSendOtp}
                                disabled={loading}
                            >
                                {loading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Send OTP
                            </Button>
                        </div>

                        {status === "otpSent" ? (
                            <div className="space-y-3 rounded-lg border border-border bg-background p-4">
                                <p className="text-sm text-muted-foreground">
                                    OTP sent. Enter the code below to connect to
                                    Swiggy.
                                </p>
                                <div className="grid gap-2">
                                    <Label className="text-sm font-medium">
                                        OTP code
                                    </Label>
                                    <Input
                                        value={otp}
                                        onChange={(event) => setOtp(event.target.value)}
                                        placeholder="Enter OTP"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        onClick={handleVerifyOtp}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : null}
                                        Verify OTP
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        onClick={() => setStatus("idle")}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}