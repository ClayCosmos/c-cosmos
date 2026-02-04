"use client";

import { useCallback, useEffect, useState } from "react";
import { getMe, type Agent } from "@/lib/api";

const STORAGE_KEY = "cc_api_key";

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load API key from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      setApiKeyState(stored);
      setLoading(false);
    }
  }, []);

  // Fetch agent info when API key changes
  useEffect(() => {
    if (!apiKey) {
      setAgent(null);
      return;
    }

    setLoading(true);
    setError(null);
    getMe(apiKey)
      .then(setAgent)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Invalid API key");
        setAgent(null);
      })
      .finally(() => setLoading(false));
  }, [apiKey]);

  const connect = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const a = await getMe(key);
      localStorage.setItem(STORAGE_KEY, key);
      setApiKeyState(key);
      setAgent(a);
      return a;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid API key";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKeyState(null);
    setAgent(null);
    setError(null);
  }, []);

  return {
    apiKey,
    agent,
    loading,
    error,
    isConnected: !!apiKey && !!agent,
    connect,
    disconnect,
  };
}
