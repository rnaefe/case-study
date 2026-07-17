"use client";

import type {
  AuditEvent,
  ChatInput,
  ChatResponse,
  EvidenceSource,
  SupportTicket,
  UsageEvent
} from "@/core";
import { useRef, useState } from "react";

export type DemoLanguage = "en" | "ar" | "arabizi";

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  direction: "ltr" | "rtl";
  sources?: EvidenceSource[];
};

const starterPrompts: Record<DemoLanguage, string[]> = {
  en: [
    "Is the linen dress available in medium?",
    "Track order ORD-1001",
    "I want to return order ORD-2002"
  ],
  ar: ["هل فستان الكتان متوفر مقاس M؟", "وين طلبي ORD-1001؟", "أبغى أرجع طلب ORD-2002"],
  arabizi: [
    "wein talabi ORD-1001?",
    "abi arja3 order ORD-2002",
    "hal linen dress size M available?"
  ]
};

export function useSupportConversation(tenantId: string) {
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [ticket, setTicket] = useState<SupportTicket>();
  const [usage, setUsage] = useState<UsageEvent>();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [failedRequest, setFailedRequest] = useState<{
    input: ChatInput;
    displayValue: string;
  }>();
  const [otpMode, setOtpMode] = useState(false);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>(starterPrompts.en);
  const [suggestedActions, setSuggestedActions] = useState<
    NonNullable<ChatResponse["suggestedActions"]>
  >([]);
  const [language, setLanguage] = useState<DemoLanguage>("en");
  const [auditOpen, setAuditOpen] = useState(false);
  const [workflowPhase, setWorkflowPhase] = useState("idle");
  const scrollRef = useRef<HTMLDivElement>(null);

  async function sendInput(chatInput: ChatInput, displayValue: string, appendUser = true) {
    if (busy) return;
    setBusy(true);
    setInput("");
    if (appendUser) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: chatInput.inputType === "submit_otp" ? "••••" : displayValue,
          direction: /[\u0600-\u06FF]/.test(displayValue) ? "rtl" : "ltr"
        }
      ]);
    }
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          conversationId,
          input: chatInput
        })
      });
      if (!response.ok) throw new Error("Request failed");
      const data = (await response.json()) as ChatResponse;
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.message,
          direction: data.direction,
          sources: data.sources
        }
      ]);
      setEvents((current) => [...data.events, ...current].slice(0, 30));
      setTicket(data.ticket);
      setUsage(data.usage);
      setWorkflowPhase(data.state.phase);
      setSuggestedReplies(data.suggestedReplies ?? []);
      setSuggestedActions(data.suggestedActions ?? []);
      setOtpMode(Boolean(data.demoOtpAvailable));
      setFailedRequest(undefined);
      setTimeout(
        () =>
          scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth"
          }),
        20
      );
    } catch {
      setFailedRequest({ input: chatInput, displayValue });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "The demo could not reach the support service. Please retry.",
          direction: "ltr"
        }
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(value = input) {
    const clean = value.trim();
    if (!clean || busy) return;
    // In OTP mode only a clean 4-digit code is submitted as an OTP; anything else
    // (e.g. "talk to a human") is sent as a normal message so the user is never trapped.
    const chatInput: ChatInput =
      otpMode && /^\d{4}$/.test(clean)
        ? { inputType: "submit_otp", code: clean }
        : { inputType: "message", message: clean };
    await sendInput(chatInput, clean);
  }

  async function requestHumanAgent() {
    if (busy) return;
    const message =
      language === "en" ? "I need to talk to a human agent." : "أحتاج التحدث مع موظف.";
    const label = language === "en" ? "Talk to an agent" : "التحدث مع موظف";
    await sendInput({ inputType: "message", message }, label);
  }

  async function reset() {
    await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, conversationId })
    });
    setConversationId(crypto.randomUUID());
    setMessages([]);
    setEvents([]);
    setTicket(undefined);
    setUsage(undefined);
    setWorkflowPhase("idle");
    setFailedRequest(undefined);
    setOtpMode(false);
    setSuggestedReplies(starterPrompts[language]);
    setSuggestedActions([]);
  }

  async function selectLanguage(next: DemoLanguage) {
    if (busy) return;
    setLanguage(next);
    if (!messages.length) setSuggestedReplies(starterPrompts[next]);
    setBusy(true);
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          conversationId,
          input: {
            inputType: "set_language",
            locale: next === "en" ? "en" : "ar"
          } satisfies ChatInput
        })
      });
    } finally {
      setBusy(false);
    }
  }

  return {
    auditOpen,
    busy,
    events,
    failedRequest,
    input,
    language,
    messages,
    otpMode,
    scrollRef,
    suggestedActions,
    suggestedReplies,
    ticket,
    usage,
    workflowPhase,
    reset,
    requestHumanAgent,
    selectLanguage,
    sendInput,
    sendMessage,
    setAuditOpen,
    setInput
  };
}

export type SupportConversationController = ReturnType<typeof useSupportConversation>;
