"use client";
import { useEffect, useRef } from "react";
import type { ChatEvent } from "./chat-logic";

/** Subscribe to the live chat SSE stream. The handler may change every render;
 *  the connection stays stable (latest handler is read via a ref). EventSource
 *  auto-reconnects on transient drops. */
export function useChatStream(onEvent: (e: ChatEvent) => void): void {
  const ref = useRef(onEvent);
  ref.current = onEvent;

  useEffect(() => {
    const es = new EventSource("/api/chat/stream");
    es.onmessage = (ev) => {
      try {
        ref.current(JSON.parse(ev.data) as ChatEvent);
      } catch {
        /* ignore malformed frames / heartbeats */
      }
    };
    return () => es.close();
  }, []);
}
