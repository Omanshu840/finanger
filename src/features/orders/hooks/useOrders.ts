import { useState, useEffect, useCallback } from "react";
import { fetchBlinkitOrders } from "../adapters";
import type { UnifiedOrder, IntegrationSource } from "../types";

const BLINKIT_STORAGE_KEY = "blinkit_auth";

function getBlinkitToken(): string | null {
  try {
    const raw = localStorage.getItem(BLINKIT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.accessToken ?? null;
  } catch {
    return null;
  }
}

export interface OrdersState {
  orders: UnifiedOrder[];
  loading: boolean;
  errors: Partial<Record<IntegrationSource, string>>;
  lastFetched: Date | null;
}

export function useOrders() {
  const [state, setState] = useState<OrdersState>({
    orders: [],
    loading: false,
    errors: {},
    lastFetched: null,
  });

  const fetchAll = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, errors: {} }));

    const results: UnifiedOrder[] = [];
    const errors: Partial<Record<IntegrationSource, string>> = {};

    // Blinkit
    const blinkitToken = getBlinkitToken();
    if (blinkitToken) {
      try {
        const orders = await fetchBlinkitOrders(blinkitToken);
        results.push(...orders);
      } catch (err: any) {
        errors["blinkit"] = err.message ?? "Failed to fetch Blinkit orders";
      }
    }

    // Future integrations — add here as they get implemented
    // const swiggyOrders = await fetchSwiggyOrders(swiggyToken);
    // results.push(...swiggyOrders);

    results.sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime());

    setState({
      orders: results,
      loading: false,
      errors,
      lastFetched: new Date(),
    });
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { ...state, refetch: fetchAll };
}