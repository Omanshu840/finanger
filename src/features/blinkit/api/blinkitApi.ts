import type { BlinkitUser } from "../types";

const PROXY_BASE = "https://blinkit.com"; // your backend proxy base path

const COMMON_HEADERS = {
  app_client: "consumer_web",
  app_version: "52434332",
  auth_key: "c761ec3633c22afad934fb17a66385c1c06c5472b4898b866b7306186d0bb477",
  platform: "mobile_web",
  rn_bundle_version: "1009003012",
  web_app_version: "1008010016",
  device_id: "a68b6c49798b102d",
};

export async function sendOtp(phone: string): Promise<{ messageId: string }> {
  const body = new URLSearchParams({ user_phone: phone });

  const res = await fetch(`${PROXY_BASE}/v2/accounts/`, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error("Failed to send OTP");

  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Failed to send OTP");

  return { messageId: data.message_id };
}

export async function verifyOtp(
  phone: string,
  code: string
): Promise<{ accessToken: string; user: BlinkitUser }> {
  const body = new URLSearchParams({ user_phone: phone, verify_code: code });

  const res = await fetch(`${PROXY_BASE}/v2/accounts/verify/phone/code/`, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error("OTP verification failed");

  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Verification failed");

  return { accessToken: data.access_token, user: data.user };
}

export async function fetchOrderHistory(accessToken: string): Promise<any[]> {
  const res = await fetch(`${PROXY_BASE}/v1/layout/order_history`, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      "content-type": "application/json",
      access_token: accessToken,
    },
  });

  if (!res.ok) throw new Error("Failed to fetch order history");

  const data = await res.json();
  if (!data.is_success) throw new Error("Order history fetch failed");

  return data.response?.snippets ?? [];
}

export async function fetchBlinkitOrderDetails(
  accessToken: string,
  orderId: string,
  cartId: string
): Promise<any[]> {
  const res = await fetch(
    `${PROXY_BASE}/v1/layout/order_details/${orderId}?cart_id=${cartId}`,
    {
      method: "POST",
      headers: {
        ...COMMON_HEADERS,
        "content-type": "application/json",
        access_token: accessToken,
      },
    }
  );

  if (!res.ok) throw new Error("Failed to fetch order details");
  const data = await res.json();
  if (!data.is_success) throw new Error("Order details fetch failed");
  return data.response?.snippets ?? [];
}