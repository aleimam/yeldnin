import { getAccess } from "@/lib/auth/access";
import { subscribe, type ChatEvent } from "@/lib/chat/bus";
import { markAllDelivered } from "@/lib/chat/chat-service";

// Server-Sent Events stream for live chat. One long-lived connection per signed-in
// browser; subscribes to the user's bus channel and pushes message/receipt/edit/
// unsend/unread events. nginx must not buffer this path (X-Accel-Buffering: no).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await getAccess();
  if (!access.user) return new Response("Unauthorized", { status: 401 });
  const userId = access.user.id;

  const encoder = new TextEncoder();
  let unsub: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (s: string) => {
        try {
          controller.enqueue(encoder.encode(s));
        } catch {
          /* stream already closed */
        }
      };
      send(": connected\n\n");
      unsub = subscribe(userId, (e: ChatEvent) => send(`data: ${JSON.stringify(e)}\n\n`));
      // ~25s heartbeat keeps the connection warm through proxies.
      heartbeat = setInterval(() => send(": ping\n\n"), 25_000);
      // This user now has a live connection → mark their inbound messages delivered.
      void markAllDelivered(userId).catch(() => {});

      req.signal.addEventListener("abort", () => {
        unsub?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsub?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
