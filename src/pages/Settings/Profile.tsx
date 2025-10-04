import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { profileSchema, type ProfileInput } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, LogOut, User, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ConnectSplitwiseButton from "@/components/integrations/ConnectSplitwiseButton";

const CURRENCIES = [
    { code: "USD", name: "US Dollar" },
    { code: "EUR", name: "Euro" },
    { code: "GBP", name: "British Pound" },
    { code: "INR", name: "Indian Rupee" },
    { code: "JPY", name: "Japanese Yen" },
    { code: "AUD", name: "Australian Dollar" },
    { code: "CAD", name: "Canadian Dollar" },
];

const TIMEZONES = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Asia/Kolkata",
    "Australia/Sydney",
];

const LOCALES = [
    { code: "en-US", name: "English (US)" },
    { code: "en-GB", name: "English (UK)" },
    { code: "en-IN", name: "English (India)" },
    { code: "de-DE", name: "German" },
    { code: "fr-FR", name: "French" },
    { code: "es-ES", name: "Spanish" },
    { code: "ja-JP", name: "Japanese" },
];

const WEEKDAYS = [
    { value: 0, name: "Sunday" },
    { value: 1, name: "Monday" },
    { value: 2, name: "Tuesday" },
    { value: 3, name: "Wednesday" },
    { value: 4, name: "Thursday" },
    { value: 5, name: "Friday" },
    { value: 6, name: "Saturday" },
];

export default function Profile() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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

    const onSubmit = async (values: ProfileInput) => {
        if (!user) return;

        setSaving(true);

        try {
            const { error } = await supabase.from("profiles").upsert(
                {
                    user_id: user.id,
                    ...values,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: "user_id",
                }
            );

            if (error) throw error;

            toast.success("Profile updated", {
                description: "Your settings have been saved",
            });
        } catch (error: any) {
            console.error("Error saving profile:", error);
            toast.error("Failed to save profile", {
                description: error.message,
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        navigate("/auth");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    Profile Settings
                </h1>
                <p className="text-muted-foreground">
                    Manage your account settings and preferences
                </p>
            </div>

            {/* User Info Card */}
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
                    <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                            <Label className="text-sm text-muted-foreground">
                                Email
                            </Label>
                            <p className="font-medium">{user?.email}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <ConnectSplitwiseButton />
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

            {/* Preferences Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Preferences</CardTitle>
                    <CardDescription>
                        Customize your app experience
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="space-y-6"
                        >
                            <FormField
                                control={form.control}
                                name="base_currency"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Base Currency</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select currency" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {CURRENCIES.map((currency) => (
                                                    <SelectItem
                                                        key={currency.code}
                                                        value={currency.code}
                                                    >
                                                        {currency.code} -{" "}
                                                        {currency.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            Your primary currency for reporting
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="timezone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Timezone</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select timezone" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {TIMEZONES.map((tz) => (
                                                    <SelectItem
                                                        key={tz}
                                                        value={tz}
                                                    >
                                                        {tz}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            Used for scheduling and date display
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="locale"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Language & Region</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select locale" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {LOCALES.map((locale) => (
                                                    <SelectItem
                                                        key={locale.code}
                                                        value={locale.code}
                                                    >
                                                        {locale.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            Affects date and number formatting
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="first_day_of_week"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>First Day of Week</FormLabel>
                                        <Select
                                            onValueChange={(value) =>
                                                field.onChange(parseInt(value))
                                            }
                                            defaultValue={field.value.toString()}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select day" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {WEEKDAYS.map((day) => (
                                                    <SelectItem
                                                        key={day.value}
                                                        value={day.value.toString()}
                                                    >
                                                        {day.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            Used in calendar and reports
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="first_day_of_month"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            First Day of Month
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={28}
                                                {...field}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        parseInt(e.target.value)
                                                    )
                                                }
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            For monthly budget cycles (1-28)
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Button
                                type="submit"
                                className="w-full sm:w-auto"
                                disabled={saving}
                            >
                                {saving && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {saving ? "Saving..." : "Save Changes"}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
