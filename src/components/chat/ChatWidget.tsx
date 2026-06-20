"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useT } from "@/i18n/client";
import { displayName } from "@/lib/users/users-logic";
import type { ChatEvent } from "@/lib/chat/chat-logic";
import { useChatStream } from "@/lib/chat/use-chat-stream";
import type {
  ConversationRow,
  MessageRow,
  ChatablePerson,
  ChatUserLite,
} from "@/lib/chat/chat-service";
import {
  loadConversationsAction,
  loadMessagesAction,
  loadChatablePeopleAction,
  sendMessageAction,
  markReadAction,
  startConversationAction,
} from "@/app/chat/actions";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";
import { NewChatPicker } from "./NewChatPicker";

type View = "list" | "thread" | "new";

/** Header 💬 launcher + a floating chat panel (portaled to <body> so the header's
 *  backdrop-blur containing block doesn't trap it). Phase A: text chat, live via
 *  SSE. Mounted in TopBar; a Phase-B hoist to a root provider will let an open
 *  panel survive navigation. */
export function ChatWidget({ meId, initialUnread }: { meId: number; initialUnread: number }) {
  const t = useT();
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [unread, setUnread] = useState(initialUnread);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [people, setPeople] = useState<ChatablePerson[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeOther, setActiveOther] = useState<ChatUserLite | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  const openRef = useRef(open);
  openRef.current = open;
  const activeIdRef = useRef<number | null>(null);
  activeIdRef.current = activeId;

  useEffect(() => setMounted(true), []);

  const refreshConversations = useCallback(async () => {
    setConversations(await loadConversationsAction());
  }, []);

  const openConversation = useCallback(
    async (id: number, other: ChatUserLite) => {
      setActiveId(id);
      setActiveOther(other);
      setView("thread");
      setMessages(await loadMessagesAction(id));
      setUnread(await markReadAction(id));
      void refreshConversations();
    },
    [refreshConversations],
  );

  // Live stream: keep the badge, the open thread and the list in sync.
  const onEvent = useCallback(
    (e: ChatEvent) => {
      if (e.kind === "unread") {
        setUnread(e.count);
        return;
      }
      const cur = activeIdRef.current;
      if (e.kind === "message") {
        if (openRef.current) void refreshConversations();
        if (cur != null && e.conversationId === cur) {
          loadMessagesAction(cur).then(setMessages);
          markReadAction(cur).then(setUnread);
        }
        return;
      }
      // receipt | edit | unsend → refresh the open thread if it's the affected one
      if (cur != null && e.conversationId === cur) {
        loadMessagesAction(cur).then(setMessages);
      }
    },
    [refreshConversations],
  );
  useChatStream(onEvent);

  // Load the list whenever the panel shows it.
  useEffect(() => {
    if (open && view === "list") void refreshConversations();
  }, [open, view, refreshConversations]);

  async function startNew() {
    setView("new");
    setPeople(await loadChatablePeopleAction());
  }

  async function pickPerson(p: ChatablePerson) {
    const res = await startConversationAction(p.id);
    if ("conversationId" in res && typeof res.conversationId === "number") {
      await openConversation(res.conversationId, p);
    }
  }

  async function send(body: string) {
    if (activeId == null) return;
    const res = await sendMessageAction({ conversationId: activeId, body });
    if (res.ok) {
      setMessages((prev) => [...prev, res.message]);
      void refreshConversations();
    }
  }

  const headerTitle =
    view === "thread" && activeOther
      ? displayName(activeOther, locale)
      : view === "new"
        ? t("chat.newChat")
        : t("chat.title");

  const panel = open ? (
    <div className="fixed bottom-4 end-4 z-50 flex h-[32rem] max-h-[80vh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        {view !== "list" && (
          <button
            onClick={() => setView("list")}
            className="text-muted hover:text-ink"
            aria-label={t("common.back")}
          >
            <span className="rtl-flip">←</span>
          </button>
        )}
        <span className="truncate font-semibold text-ink">{headerTitle}</span>
        <div className="ms-auto flex items-center gap-1.5">
          {view === "list" && (
            <button onClick={startNew} className="btn-primary btn-sm">
              {t("chat.new")}
            </button>
          )}
          <button onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label={t("common.close")}>
            ✕
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {view === "list" && <ConversationList rows={conversations} onOpen={openConversation} />}
        {view === "thread" && activeId != null && (
          <MessageThread meId={meId} messages={messages} onSend={send} />
        )}
        {view === "new" && <NewChatPicker people={people} onPick={pickPerson} />}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("chat.title")}
        className="relative text-muted hover:text-ink"
      >
        💬
        {unread > 0 && (
          <span className="absolute -end-1 -top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
