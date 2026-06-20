import { describe, it, expect } from "vitest";
import {
  canonicalPair,
  isSelfPair,
  otherUserId,
  tickState,
  canEditMessage,
  canUnsendMessage,
  isEdited,
  displayBody,
  previewOf,
  unreadCount,
  sortConversations,
  validateMessageInput,
  EDIT_WINDOW_MIN,
  type MsgLike,
} from "./chat-logic";

const now = new Date("2026-06-20T12:00:00Z");
const mins = (n: number) => new Date(now.getTime() - n * 60_000);

function msg(over: Partial<MsgLike> = {}): MsgLike {
  return {
    senderId: 1,
    body: "hi",
    createdAt: now,
    deliveredAt: null,
    readAt: null,
    editedAt: null,
    unsentAt: null,
    attachmentCount: 0,
    ...over,
  };
}

describe("chat-logic", () => {
  it("canonicalPair always puts the lower id first", () => {
    expect(canonicalPair(3, 7)).toEqual({ userAId: 3, userBId: 7 });
    expect(canonicalPair(7, 3)).toEqual({ userAId: 3, userBId: 7 });
  });

  it("isSelfPair detects self-chat", () => {
    expect(isSelfPair(5, 5)).toBe(true);
    expect(isSelfPair(5, 6)).toBe(false);
  });

  it("otherUserId returns the non-viewer participant", () => {
    const conv = { userAId: 3, userBId: 7 };
    expect(otherUserId(conv, 3)).toBe(7);
    expect(otherUserId(conv, 7)).toBe(3);
  });

  it("tickState reflects sent/delivered/read for the sender only", () => {
    expect(tickState(msg(), 1)).toBe("sent");
    expect(tickState(msg({ deliveredAt: now }), 1)).toBe("delivered");
    expect(tickState(msg({ deliveredAt: now, readAt: now }), 1)).toBe("read");
    // recipient sees no tick
    expect(tickState(msg({ readAt: now }), 2)).toBe("none");
    // retracted shows no tick
    expect(tickState(msg({ unsentAt: now, readAt: now }), 1)).toBe("none");
  });

  it("canEditMessage honours sender + 15-min window + not-retracted", () => {
    expect(canEditMessage(msg({ createdAt: mins(5) }), 1, now)).toBe(true);
    expect(canEditMessage(msg({ createdAt: mins(EDIT_WINDOW_MIN + 1) }), 1, now)).toBe(false);
    expect(canEditMessage(msg({ createdAt: mins(5) }), 2, now)).toBe(false); // not sender
    expect(canEditMessage(msg({ createdAt: mins(5), unsentAt: now }), 1, now)).toBe(false);
  });

  it("canUnsendMessage allows the sender any time, once", () => {
    expect(canUnsendMessage(msg(), 1)).toBe(true);
    expect(canUnsendMessage(msg({ createdAt: mins(9999) }), 1)).toBe(true); // no time limit
    expect(canUnsendMessage(msg(), 2)).toBe(false);
    expect(canUnsendMessage(msg({ unsentAt: now }), 1)).toBe(false);
  });

  it("isEdited / displayBody respect the retract tombstone", () => {
    expect(isEdited(msg({ editedAt: now }))).toBe(true);
    expect(isEdited(msg({ editedAt: now, unsentAt: now }))).toBe(false);
    expect(displayBody(msg({ body: "hello" }))).toBe("hello");
    expect(displayBody(msg({ body: "hello", unsentAt: now }))).toBe("");
  });

  it("previewOf classifies unsent / photo-only / text", () => {
    expect(previewOf(msg({ unsentAt: now }))).toEqual({ kind: "unsent", text: "" });
    expect(previewOf(msg({ body: "", attachmentCount: 2 }))).toEqual({ kind: "photo", text: "" });
    expect(previewOf(msg({ body: "yo", attachmentCount: 1 }))).toEqual({ kind: "text", text: "yo" });
  });

  it("unreadCount counts inbound, unread, non-retracted only", () => {
    const list = [
      msg({ senderId: 2 }), // inbound, unread → counts
      msg({ senderId: 2, readAt: now }), // read → no
      msg({ senderId: 2, unsentAt: now }), // retracted → no
      msg({ senderId: 1 }), // mine → no
    ];
    expect(unreadCount(list, 1)).toBe(1);
  });

  it("sortConversations orders most-recent-first without mutating", () => {
    const a = { lastMessageAt: new Date("2026-06-01T00:00:00Z") };
    const b = { lastMessageAt: new Date("2026-06-10T00:00:00Z") };
    const input = [a, b];
    expect(sortConversations(input)).toEqual([b, a]);
    expect(input).toEqual([a, b]); // unchanged
  });

  it("validateMessageInput requires body or attachment, caps length", () => {
    expect(validateMessageInput({ body: "  " })).toEqual({ ok: false, error: "chat.err.empty" });
    expect(validateMessageInput({ body: "", attachmentCount: 1 })).toEqual({ ok: true });
    expect(validateMessageInput({ body: "hi" })).toEqual({ ok: true });
    expect(validateMessageInput({ body: "x".repeat(4001) })).toEqual({ ok: false, error: "chat.err.tooLong" });
  });
});
