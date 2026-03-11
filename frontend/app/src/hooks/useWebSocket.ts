"use client";

import { useEffect, useRef, useCallback } from "react";
import { getWS } from "@/lib/ws";

export function useWSChannel(
  channel: string | null,
  onMessage: (data: unknown) => void
) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!channel) return;
    const ws = getWS();
    const handler = (data: unknown) => handlerRef.current(data);
    ws.subscribe(channel, handler);
    return () => ws.unsubscribe(channel, handler);
  }, [channel]);
}

export function useShellInput() {
  return useCallback((channel: string, input: string) => {
    getWS().sendShellInput(channel, input);
  }, []);
}
