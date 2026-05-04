import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { profileSchema, type ProfileInput } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { toast } from "sonner";
import {
  Loader2,
  LogOut,
  User,
  Mail,
  PlugZap,
  ChevronRight,
  UtensilsCrossed,
  Wallet,
  ShoppingBag,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import ConnectSplitwiseButton from "@/features/splitwise/components/ConnectSplitwiseButton";
import { SwiggyIntegration } from "@/features/swiggy/components/SwiggyIntegration";
import { cn } from "@/lib/utils";
import { BlinkitIntegration } from "@/features/blinkit/components/BlinkitIntegration";

type IntegrationKey = "splitwise" | "swiggy" | "blinkit";

const integrations = [
  {
    key: "splitwise" as const,
    name: "Splitwise",
    description: "Sync shared expenses and settlements",
    icon: Wallet,
    iconClass:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  {
    key: "swiggy" as const,
    name: "Swiggy",
    description: "Import and manage food order history",
    icon: UtensilsCrossed,
    iconClass:
      "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  {
    key: "blinkit" as const,
    name: "Blinkit",
    description: "Import grocery order history",
    icon: ShoppingBag,
    iconClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  }
];

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] =
    useState<IntegrationKey | null>(null);

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      base_currency: "INR",
      timezone: "UTC",
      locale: "en-US",
      first_day_of_week: 0,
      first_day_of_month: 1,
      number_format: "en-US",
    },
  });

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        form.reset({
          base_currency: data.base_currency,
          timezone: data.timezone,
          locale: data.locale,
          first_day_of_week: data.first_day_of_week,
          first_day_of_month: data.first_day_of_month,
          number_format: data.number_format,
        });
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const selectedMeta = integrations.find(
    (item) => item.key === selectedIntegration
  );

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and connected integrations
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
              <CardDescription>
                Your account details and authentication status
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <Label className="text-sm text-muted-foreground">Email</Label>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>

              <Button
                onClick={handleSignOut}
                variant="destructive"
                className="w-full sm:w-auto"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlugZap className="h-5 w-5" />
                Integrations
              </CardTitle>
              <CardDescription>
                Select an integration to open its management panel
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {integrations.map((integration) => {
                const Icon = integration.icon;

                return (
                  <button
                    key={integration.key}
                    type="button"
                    onClick={() => setSelectedIntegration(integration.key)}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
                      "hover:bg-muted/40 hover:shadow-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl",
                        integration.iconClass
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{integration.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {integration.description}
                      </p>
                    </div>

                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <Drawer
        open={!!selectedIntegration}
        onOpenChange={(open) => {
          if (!open) setSelectedIntegration(null);
        }}
      >
        <DrawerContent className="mx-auto max-w-2xl">
          <DrawerHeader className="text-left">
            <DrawerTitle>{selectedMeta?.name}</DrawerTitle>
            <DrawerDescription>
              {selectedMeta?.description}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-6">
            <div className="rounded-xl border bg-muted/20 p-4">
              {selectedIntegration === "splitwise" && <ConnectSplitwiseButton />}
              {selectedIntegration === "swiggy" && <SwiggyIntegration />}
              {selectedIntegration === "blinkit" && <BlinkitIntegration />}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}