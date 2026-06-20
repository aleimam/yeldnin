"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useLocale, useT } from "@/i18n/client";
import { displayName } from "@/lib/users/users-logic";
import type { ChatEvent } from "@/lib/chat/chat-logic";
import { useChatStream } from "@/lib/chat/use-chat-stream";
import { statusLabelKey } from "@/lib/inquiry/inquiry-logic";
import type { ConversationRow, MessageRow, ChatablePerson, ChatUserLite } from "@/lib/chat/chat-service";
import type { InquiryListRow } from "@/lib/inquiry/inquiry-service";
import {
  loadConversationsAction,
  loadMessagesAction,
  loadChatablePeopleAction,
  sendMessageAction,
  editMessageAction,
  unsendMessageAction,
  markReadAction,
  startConversationAction,
} from "@/app/chat/actions";
import { loadMyInquiriesAction } from "@/app/inquiries/actions";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";
import { NewChatPicker } from "./NewChatPicker";

type View = "list" | "thread" | "new";
type Tab = "chats" | "inquiries";

/** Header 💬 launcher + a floating panel (portaled to <body> so the header's
 *  backdrop-blur containing block doesn't trap it). Two tabs: Chats (1:1 live
 *  chat) and Inquiries (unit-scoped Q&A). Live via SSE. Mounted in TopBar. */
export function ChatWidget({ meId, initialUnread }: { meId: number; initialUnread: number }) {
  const t = useT();
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chats");
  const [view, setView] = useState<View>("list");
  const [unread, setUnread] = useState(initialUnread);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [people, setPeople] = useState<ChatablePerson[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeOther, setActiveOther] = useState<ChatUserLite | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [inquiries, setInquiries] = useState<InquiryListRow[]>([]);
  const [inquiryDot, setInquiryDot] = useState(false);

  const openRef = useRef(open);
  openRef.current = open;
  const activeIdRef = useRef<number | null>(null);
  activeIdRef.current = activeId;
  const tabRef = useRef<Tab>(tab);
  tabRef.current = tab;

  useEffect(() => setMounted(true), []);

  const refreshConversations = useCallback(async () => {
    setConversations(await loadConversationsAction());
  }, []);
  const refreshInquiries = useCallback(async () => {
    setInquiries(await loadMyInquiriesAction());
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

  const onEvent = useCallback(
    (e: ChatEvent) => {
      if (e.kind === "unread") {
        setUnread(e.count);
        return;
      }
      if (e.kind === "inquiry") {
        if (openRef.current && tabRef.current === "inquiries") void refreshInquiries();
        else setInquiryDot(true);
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
      if ((e.kind === "receipt" || e.kind === "edit" || e.kind === "unsend") && cur != null && e.conversationId === cur) {
        loadMessagesAction(cur).then(setMessages);
      }
    },
    [refreshConversations, refreshInquiries],
  );
  useChatStream(onEvent);

  useEffect(() => {
    if (open && tab === "chats" && view === "list") void refreshConversations();
    if (open && tab === "inquiries") void refreshInquiries();
  }, [open, tab, view, refreshConversations, refreshInquiries]);

  function switchTab(next: Tab) {
    setTab(next);
    if (next === "inquiries") setInquiryDot(false);
  }

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

  async function send(
    body: string,
    attachments: { assetId: string; width: number; height: number }[],
    replyToId: number | null,
  ) {
    if (activeId == null) return;
    const res = await sendMessageAction({ conversationId: activeId, body, attachments, replyToId: replyToId ?? undefined });
    if (res.ok) {
      setMessages((prev) => [...prev, res.message]);
      void refreshConversations();
    }
  }

  async function editMsg(id: number, body: string) {
    const res = await editMessageAction(id, body);
    if (res.ok && activeId != null) setMessages(await loadMessagesAction(activeId));
  }

  async function unsendMsg(id: number) {
    const res = await unsendMessageAction(id);
    if (res.ok && activeId != null) {
      setMessages(await loadMessagesAction(activeId));
      void refreshConversations();
    }
  }

  const inChatThread = tab === "chats" && view !== "list";
  const headerTitle = inChatThread
    ? view === "thread" && activeOther
      ? displayName(activeOther, locale)
      : t("chat.newChat")
    : tab === "inquiries"
      ? t("inq.title")
      : t("chat.title");

  const panel = open ? (
    <div className="fixed inset-2 z-50 flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:inset-auto sm:bottom-4 sm:end-4 sm:h-[32rem] sm:max-h-[80vh] sm:w-[22rem]">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        {inChatThread && (
          <button onClick={() => setView("list")} className="text-muted hover:text-ink" aria-label={t("common.back")}>
            <span className="rtl-flip">←</span>
          </button>
        )}
        <span className="truncate font-semibold text-ink">{headerTitle}</span>
        <div className="ms-auto flex items-center gap-1.5">
          {tab === "chats" && view === "list" && (
            <button onClick={startNew} className="btn-primary btn-sm">
              {t("chat.new")}
            </button>
          )}
          <button onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label={t("common.close")}>
            ✕
          </button>
        </div>
      </div>

      {!inChatThread && (
        <div className="flex border-b border-line">
          {(["chats", "inquiries"] as Tab[]).map((tk) => (
            <button
              key={tk}
              onClick={() => switchTab(tk)}
              className={`relative flex-1 py-2 text-sm font-medium ${tab === tk ? "border-b-2 border-brand text-ink" : "text-muted hover:text-ink"}`}
            >
              {tk === "chats" ? t("chat.title") : t("inq.title")}
              {tk === "inquiries" && inquiryDot && (
                <span className="absolute end-3 top-1.5 h-2 w-2 rounded-full bg-red-600" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {tab === "chats" ? (
          <>
            {view === "list" && <ConversationList rows={conversations} onOpen={openConversation} />}
            {view === "thread" && activeId != null && (
              <MessageThread meId={meId} messages={messages} onSend={send} onEdit={editMsg} onUnsend={unsendMsg} />
            )}
            {view === "new" && <NewChatPicker people={people} onPick={pickPerson} />}
          </>
        ) : (
          <InquiriesPanel rows={inquiries} locale={locale} onNavigate={() => setOpen(false)} />
        )}
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

function InquiriesPanel({
  rows,
  locale,
  onNavigate,
}: {
  rows: InquiryListRow[];
  locale: string;
  onNavigate: () => void;
}) {
  const t = useT();
  if (!rows.length) {
    return <p className="grid h-full place-items-center px-6 text-center text-sm text-muted">{t("inq.empty")}</p>;
  }
  return (
    <ul className="h-full divide-y divide-line overflow-y-auto">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`/inquiries/${r.id}`} onClick={onNavigate} className="block px-3 py-2.5 hover:bg-canvas">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-ink">{r.uid ?? `#${r.id}`}</span>
              <span className="shrink-0 text-[10px] text-muted">{t(statusLabelKey(r.status))}</span>
            </div>
            <div className="truncate text-xs text-muted">
              {displayName(r.initiator, locale)} → {displayName(r.recipient, locale)} · {t(`inq.kind.${r.unitKind}`)} #{r.unitId}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
