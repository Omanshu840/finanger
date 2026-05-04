import { useState, useCallback } from "react";
import { sendOtp, verifyOtp } from "../api/blinkitApi";
import type { BlinkitAuthState } from "../types";

const STORAGE_KEY = "blinkit_auth";

const INITIAL_STATE: BlinkitAuthState = {
  step: "idle",
  phone: "",
  messageId: null,
  accessToken: null,
  user: null,
  loading: false,
  error: null,
};

function loadFromStorage(): Partial<BlinkitAuthState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveToStorage(phone: string, accessToken: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ phone, accessToken }));
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useBlinkitAuth() {
  const [state, setState] = useState<BlinkitAuthState>(() => {
    const stored = loadFromStorage();
    if (stored.accessToken) {
      return {
        ...INITIAL_STATE,
        step: "verified",
        accessToken: stored.accessToken,
        phone: stored.phone ?? "",
      };
    }
    return INITIAL_STATE;
  });

  const requestOtp = useCallback(async (phone: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null, phone }));
    try {
      const { messageId } = await sendOtp(phone);
      setState((prev) => ({
        ...prev,
        step: "otp_sent",
        messageId,
        loading: false,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err.message ?? "Failed to send OTP",
      }));
    }
  }, []);

  const confirmOtp = useCallback(
    async (code: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const { accessToken, user: blinkitUser } = await verifyOtp(
          state.phone,
          code
        );

        saveToStorage(state.phone, accessToken);

        setState((prev) => ({
          ...prev,
          step: "verified",
          accessToken,
          user: blinkitUser,
          loading: false,
        }));
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err.message ?? "Invalid OTP",
        }));
      }
    },
    [state.phone]
  );

  const disconnect = useCallback(() => {
    clearStorage();
    setState(INITIAL_STATE);
  }, []);

  return { state, requestOtp, confirmOtp, disconnect };
}