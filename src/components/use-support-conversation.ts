"use client";

import type {
  ApplicationOutcome,
  AuditEvent,
  ChatInput,
  ChatResponse,
  ConversationPhase,
  EvidenceSource,
  Intent,
  SupportTicket,
  UsageEvent
} from "@/core";
import { useRef, useState } from "react";

export type DemoLanguage = "en" | "ar" | "arabizi";
export type InspectorTab = "tenant" | "decisions";

export type DecisionSnapshot = {
  outcome: ApplicationOutcome;
  phase: ConversationPhase;
  activeIntent?: Intent | undefined;
  lastIntent?: Intent | undefined;
  verifiedOrderId?: string | undefined;
  productId?: string | undefined;
  sources: EvidenceSource[];
};

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  direction: "ltr" | "rtl";
  sources?: EvidenceSource[];
};

const fashionStarterPrompts: Record<DemoLanguage, string[]> = {
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

const electronicsStarterPrompts: Record<DemoLanguage, string[]> = {
  en: [
    "Are the wireless earbuds available in black?",
    "Track order ORD-1001",
    "I want to return order ORD-1001"
  ],
  ar: ["هل السماعات اللاسلكية متوفرة بالأسود؟", "وين طلبي ORD-1001؟", "أبغى أرجع طلب ORD-1001"],
  arabizi: [
    "wein talabi ORD-1001?",
    "abi arja3 order ORD-1001",
    "hal wireless earbuds black available?"
  ]
};

function starterPromptsFor(tenantId: string): Record<DemoLanguage, string[]> {
  return tenantId === "ksa-electronics" ? electronicsStarterPrompts : fashionStarterPrompts;
}

export function useSupportConversation(tenantId: string) {
  const starters = starterPromptsFor(tenantId);
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
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>(
    () => starterPromptsFor(tenantId).en
  );
  const [suggestedActions, setSuggestedActions] = useState<
    NonNullable<ChatResponse["suggestedActions"]>
  >([]);
  const [language, setLanguage] = useState<DemoLanguage>("en");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("tenant");
  const [decision, setDecision] = useState<DecisionSnapshot>();
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
      setDecision({
        outcome: data.outcome,
        phase: data.state.phase,
        activeIntent: data.state.activeIntent,
        lastIntent: data.state.lastResolvedIntent,
        verifiedOrderId: data.state.authenticatedAccess?.orderId ?? data.state.orderId,
        productId: data.state.productContext?.productId,
        sources: data.sources
      });
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
    setDecision(undefined);
    setFailedRequest(undefined);
    setOtpMode(false);
    setSuggestedReplies(starters[language]);
    setSuggestedActions([]);
    closeInspector();
  }

  function openInspector(tab: InspectorTab = "decisions") {
    setInspectorTab(tab);
    setInspectorOpen(true);
  }

  function closeInspector() {
    setInspectorOpen(false);
    setInspectorTab("tenant");
  }

  function selectInspectorTab(tab: InspectorTab) {
    setInspectorTab(tab);
  }

  async function selectLanguage(next: DemoLanguage) {
    if (busy) return;
    const previous = language;
    setLanguage(next);
    if (!messages.length) setSuggestedReplies(starters[next]);
    setBusy(true);
    try {
      const response = await fetch("/api/chat", {
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
      if (!response.ok) throw new Error("Language update failed");
    } catch {
      setLanguage(previous);
      if (!messages.length) setSuggestedReplies(starters[previous]);
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    decision,
    events,
    failedRequest,
    input,
    inspectorOpen,
    inspectorTab,
    language,
    messages,
    otpMode,
    scrollRef,
    suggestedActions,
    suggestedReplies,
    ticket,
    usage,
    closeInspector,
    openInspector,
    reset,
    requestHumanAgent,
    selectLanguage,
    sendInput,
    sendMessage,
    setInput,
    selectInspectorTab
  };
}

export type SupportConversationController = ReturnType<typeof useSupportConversation>;
