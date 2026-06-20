# Chat & Inquiry Module — Design (locked)

Source: `YeldnIN-Chat.docx`. Locked 2026-06-20. **Chat decisions are final;
Inquiry routing/status (Q13–Q14) are provisional** — see `OPEN` markers in the
Inquiry section. This is the single source of truth; update it before changing
behaviour.

## Scope

One "Chat" module with two subsystems, plus a shared floating widget + header
indicator:

1. **Chat** — real-time **1:1** direct messaging between any two users.
2. **Inquiry** — structured, unit-scoped Q&A routed to a team (Phase C).

Chat is **universal** (every authenticated user, like Notifications/Account) — it
is *not* a permission-gated entry in the module switcher. Admin-only surfaces
(inquiry analytics, disposition catalog) live under Settings.

## Locked decisions (resolutions to the 17 discussion questions)

- **1:1 only**, no group chat. [Q6]
- **Transport = SSE** over a single in-process event bus. YeldnIN runs as one PM2
  process, so fan-out needs no Redis/broker. POST (Server Action) to send; an SSE
  stream to receive messages, receipts and unread counts. Prod nginx needs
  `proxy_buffering off` on the stream path (guided deploy step). [Q2]
- **"Synchronous"** = appears within ~1s without refresh; offline users get it on
  return **+ web push**. Not "both must be online". [Q2]
- **Receipts = 3 states**: `✓` sent · `✓✓` gray delivered · `✓✓` blue read.
  Always-on, no privacy toggle. [Q7]
- **Edit window 15 min** (reuse the expenses time-window pattern); edited messages
  show an "edited" marker. [Q8]
- **Unsend**: sender-only, **no time limit**, retracts for both parties → a
  "message deleted" tombstone. [Q8]
- **Attachments = photos**, compressed **client-side** (canvas → WebP, ≤1600px
  longest edge, ~0.8 quality) before upload; stored via the existing `/api/upload`,
  served through the participant-gated `/api/asset/[id]`. [Q3]
- **"Compress photos in all modules"** = a separate **Phase D** retrofit of the
  shared uploader; chat/inquiry get it first. [Q3]
- **Text messages are not compressed** (negligible). [Q4]
- **No real email/SMTP** — "Email" in the doc title = the Inquiry side. [Q5]
- **Reach**: every authenticated user; RTL-aware (widget docks bottom-**start** in
  Arabic). [Q10]
- **Mobile**: floating widget on desktop **+ a full-page `/chat` route** on mobile
  (shared components). [Q9]
- **Two header streams**: 🔔 system notifications (existing) and 💬 chat+inquiries
  (new). Chat messages → 💬 badge + push-if-offline; inquiries → 🔔 + 💬 + push. [Q16]
- **Widget has two tabs**: **Chats** | **Inquiries**. Inquiries are surfaced in the
  Inquiries tab, **not** injected into 1:1 DMs. [Q16]

## Data model — Phase A (chat)

- `ChatConversation(userAId < userBId canonical, lastMessageAt, createdAt)` — one
  row per unordered pair (`@@unique([userAId, userBId])`).
- `ChatMessage(conversationId, senderId, body, replyToId?, deliveredAt?, readAt?,
  editedAt?, unsentAt?, createdAt)`. For 1:1, `deliveredAt`/`readAt` describe the
  **recipient**, so the sender renders ticks directly off the message row.
- `ChatAttachment(messageId, assetId, width?, height?, createdAt)`.
- Indices: `ChatMessage(conversationId, createdAt)`, `ChatMessage(senderId)`,
  conversation per-user.

Unread-for-me = messages in my conversations where `senderId != me`,
`readAt IS NULL`, `unsentAt IS NULL`.

## Transport — Phase A

- `src/lib/chat/bus.ts` — a `globalThis`-pinned `EventEmitter` (survives dev HMR).
  `publish(userId, event)` / `subscribe(userId, handler) → unsubscribe`.
- `GET /api/chat/stream` — App Router route returning a long-lived `ReadableStream`
  (SSE). Subscribes the caller; emits `message | receipt | edit | unsend | unread`.
  Sets `Content-Type: text/event-stream`, `X-Accel-Buffering: no`, and a ~25s
  heartbeat comment to keep the connection warm.
- Send / edit / unsend / markRead are **Server Actions** → service writes →
  `bus.publish(...)` to both participants.

## Receipts — Phase A/B

- On SSE connect, the recipient auto-acks delivery for any undelivered inbound
  messages → set `deliveredAt` → publish `receipt` to the sender.
- Opening a conversation → `markRead` sets `readAt` on unread inbound → publish.
- Sender tick: `unsentAt` → none · `readAt` → blue ✓✓ · `deliveredAt` → gray ✓✓ ·
  else gray ✓.

## UI — Phase A/B

- Header **💬** with unread badge, beside the existing 🔔.
- `ChatWidget` mounted in `AppShell`: launcher (bottom-end) → panel with **Chats |
  Inquiries** tabs. Chats = conversation list (recent first; unread bold + count) →
  message pane (lazy-loaded history + composer). **New** → user picker
  (recently-chatted first, then all active users, searchable).
- Message pane: bubbles, reply-to quoting, emoji picker, photo upload + preview,
  inline edit (15 min), unsend (confirm), ticks, "edited" marker.
- `/chat` full-page route mirrors the panel for mobile.

## Inquiry — Phase C (provisional)

- `Inquiry(unitType: ITEM|CONTAINER, unitId, initiatorId, recipientUserId,
  recipientTeamId, status, dispositionId?, createdAt, closedAt?)`
  + `InquiryMessage` (thread; text + photos)
  + `InquiryDisposition` (admin catalog: Solved / Not Answered / No Need).
- Initiated from an item/container page; the actor list is derived from the unit's
  **History/movement** trail. Fan-out to the recipient's **whole team**.
- `OPEN [Q13]`: first reply → auto-"Answered"; the initiator side later **closes**
  with a disposition. Confirm the two-state separation.
- `OPEN [Q14]`: who may close — the whole initiator team vs. only the opener.
- `OPEN [Q11/Q12]`: confirm unit = item + container only, and fan-out targets the
  picked actor's team (not every team that touched the unit).
- Admin: all-inquiries list + analytics. Each event → 🔔 + 💬 (Inquiries tab) + push.

## Phasing

- **A** — chat core: schema + migration, pure logic + tests, SSE bus + stream,
  service, actions, header 💬 + widget + conversation list + new-chat picker, text
  only. i18n + verify + commit.
- **B** — rich chat: photos + client compression, emoji, reply-to, edit (15m),
  unsend, the 3-tick receipts, mobile `/chat`.
- **C** — inquiry system (after Q13/Q14 confirmed).
- **D** — all-modules compression retrofit + i18n parity + full verify.

## Conventions

- `chat-logic.ts` (pure, vitest) + `chat-service.ts` (`import "server-only"`).
- Server Actions: guard → service → `revalidatePath`. Validation errors `{ error }`.
- en/ar i18n parity (key counts must stay equal). RTL via logical props.
- Soft-delete via `unsentAt` (messages); no native image libraries (client-side
  compression only). Asset fetches participant-gated.
