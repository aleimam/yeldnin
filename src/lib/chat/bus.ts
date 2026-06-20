import "server-only";
import { EventEmitter } from "node:events";
import type { ChatEvent } from "./chat-logic";

// Process-wide chat event bus. YeldnIN runs as a single PM2 fork, so in-process
// fan-out needs no external broker. Pinned on globalThis so dev HMR reuses one
// emitter instead of leaking a new one per reload. Events are addressed to a
// recipient userId; each open SSE stream subscribes to its own user channel.

export type { ChatEvent };

const g = globalThis as unknown as { __chatBus?: EventEmitter };
const bus = g.__chatBus ?? new EventEmitter();
bus.setMaxListeners(0); // unbounded concurrent SSE subscribers
g.__chatBus = bus;

const channel = (userId: number) => `u:${userId}`;

/** Deliver an event to every live stream of a single user. */
export function publish(userId: number, event: ChatEvent): void {
  bus.emit(channel(userId), event);
}

/** Subscribe a user's stream to its events; returns an unsubscribe fn. */
export function subscribe(userId: number, handler: (e: ChatEvent) => void): () => void {
  const ch = channel(userId);
  bus.on(ch, handler);
  return () => {
    bus.off(ch, handler);
  };
}
