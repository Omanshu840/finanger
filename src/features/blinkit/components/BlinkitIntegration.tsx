import { useState } from "react";
import { useBlinkitAuth } from "../hooks/useBlinkitAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Unplug, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

export function BlinkitIntegration() {
  const { state, requestOtp, confirmOtp, disconnect } = useBlinkitAuth();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestOtp(phone.trim());
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await confirmOtp(otp.trim());
  };

  // Connected state
  if (state.step === "verified") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-green-800 dark:text-green-300">
              Connected
            </p>
            <p className="text-sm text-green-700 dark:text-green-400">
              {state.phone
                ? `+91 ${state.phone}`
                : "Blinkit account linked"}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full sm:w-auto text-destructive hover:text-destructive"
          onClick={disconnect}
        >
          <Unplug className="mr-2 h-4 w-4" />
          Disconnect Blinkit
        </Button>
      </div>
    );
  }

  // OTP entry state
  if (state.step === "otp_sent") {
    return (
      <form onSubmit={handleVerifyOtp} className="space-y-4">
        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          OTP sent to <span className="font-medium text-foreground">+91 {state.phone}</span>. 
          Enter the 4-digit code below.
        </div>

        <div className="space-y-2">
          <Label htmlFor="otp">Verification Code</Label>
          <Input
            id="otp"
            type="text"
            inputMode="numeric"
            pattern="\d{4,6}"
            maxLength={6}
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
            autoFocus
          />
        </div>

        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={state.loading || otp.length < 4}>
            {state.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify OTP
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              // reset back to phone entry
              import("../hooks/useBlinkitAuth").then(() => setOtp(""))
            }
          >
            Change Number
          </Button>
        </div>
      </form>
    );
  }

  // Idle — phone entry state
  return (
    <form onSubmit={handleSendOtp} className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4">
        <ShoppingBag className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
        <p className="text-sm text-muted-foreground">
          Connect your Blinkit account to automatically import your grocery
          order history.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="blinkit-phone">Mobile Number</Label>
        <div className="flex gap-2">
          <span
            className={cn(
              "flex items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground"
            )}
          >
            +91
          </span>
          <Input
            id="blinkit-phone"
            type="tel"
            inputMode="numeric"
            pattern="\d{10}"
            maxLength={10}
            placeholder="10-digit mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={state.loading || phone.length !== 10}>
        {state.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Send OTP
      </Button>
    </form>
  );
}