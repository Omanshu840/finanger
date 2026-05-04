export interface BlinkitUser {
  id: number;
  phone: string;
  verified: boolean;
  country_code: string;
}

export interface BlinkitAuthState {
  step: "idle" | "otp_sent" | "verified";
  phone: string;
  messageId: string | null;
  accessToken: string | null;
  user: BlinkitUser | null;
  loading: boolean;
  error: string | null;
}