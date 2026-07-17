import type { ChatResponse, TenantConfig } from "@/core";
import type { SupportConversationController } from "./use-support-conversation";

export function ConversationPanel({
  tenant,
  conversation
}: {
  tenant: TenantConfig;
  conversation: SupportConversationController;
}) {
  const {
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
    reset,
    requestHumanAgent,
    selectLanguage,
    sendInput,
    sendMessage,
    setAuditOpen,
    setInput
  } = conversation;
  const isArabic = language === "ar";
  const isStarter = !messages.length && !suggestedActions.length;

  return (
    <section className="chat-panel">
      <div className="panel-heading">
        <div className="conversation-title">
          <span className="tenant-avatar">{tenant.branding.logoText}</span>
          <div>
            <strong>{tenant.displayName}</strong>
            <span>
              <i className="status-dot" /> Online customer support
            </span>
          </div>
        </div>
        <div className="conversation-actions">
          <button
            className="secondary-button trace-button"
            aria-label="View trace"
            onClick={() => setAuditOpen(true)}
          >
            Trace
            {events.length ? <span>{events.length}</span> : null}
          </button>
          <button className="secondary-button" onClick={reset}>
            New chat
          </button>
        </div>
      </div>

      <div className="language-bar">
        <span>Reply language</span>
        <div className="language-tabs" aria-label="Demo language">
          {(["en", "ar", "arabizi"] as const).map((item) => (
            <button
              key={item}
              className={language === item ? "active" : ""}
              onClick={() => void selectLanguage(item)}
            >
              {item === "en" ? "English" : item === "ar" ? "العربية" : "Arabizi"}
            </button>
          ))}
        </div>
      </div>

      <div className="messages" ref={scrollRef}>
        {!messages.length ? (
          <div className="welcome-card">
            <span className="welcome-kicker">Product · Orders · Returns</span>
            <h2>
              {language === "ar"
                ? "هلا! كيف أقدر أساعدك؟"
                : language === "arabizi"
                  ? "Hala! Keef agdar asa3dak?"
                  : "How can I help today?"}
            </h2>
            <p>
              {language === "ar"
                ? "أقدر أساعدك بمعلومات المنتجات، تتبع الطلب، وبدء طلب إرجاع."
                : language === "arabizi"
                  ? "Es2al 3an product, tabbe3 talabik b aman, aw ibda2 return."
                  : "Ask about a product, securely track an order, or start a return."}
            </p>
          </div>
        ) : null}
        {messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`} dir={message.direction}>
            <div className="message-bubble">{message.content}</div>
            {message.sources?.length ? (
              <div className="sources">
                {message.sources.map((source) => (
                  <span key={source.id}>↗ {source.label}</span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
        {busy ? (
          <div className="typing" aria-label="Assistant is responding">
            <i />
            <i />
            <i />
          </div>
        ) : null}
      </div>

      {suggestedActions.length || suggestedReplies.length ? (
        <div
          className={`suggestions ${suggestedActions.length ? "workflow-card" : ""} ${
            isStarter ? "starter-suggestions" : ""
          }`}
          aria-label={
            suggestedActions.length ? workflowActionLabel(suggestedActions) : "Suggested prompts"
          }
        >
          {suggestedActions.length ? (
            <span className="workflow-label">{workflowActionLabel(suggestedActions)}</span>
          ) : null}
          {suggestedActions.length
            ? suggestedActions.map((item) => (
                <button
                  key={`${item.action.inputType}:${item.label}`}
                  dir="auto"
                  onClick={() => sendInput(item.action, item.label)}
                >
                  {item.label}
                </button>
              ))
            : suggestedReplies.map((reply) => (
                <button key={reply} dir="auto" onClick={() => sendMessage(reply)}>
                  {reply}
                </button>
              ))}
        </div>
      ) : null}

      {failedRequest ? (
        <div className="error-notice" role="alert">
          <span>The last request did not complete.</span>
          <button
            onClick={() => void sendInput(failedRequest.input, failedRequest.displayValue, false)}
            disabled={busy}
          >
            Retry
          </button>
        </div>
      ) : null}

      {otpMode ? (
        <div className="otp-notice" dir={isArabic ? "rtl" : "ltr"}>
          <span className="secure-icon" aria-hidden="true">
            ✓
          </span>
          <div className="otp-copy">
            <strong>{isArabic ? "تحقق آمن" : "Secure verification"}</strong>
            <span>
              {isArabic
                ? "الرمز يبقى خارج النموذج وسجل التدقيق."
                : "The code stays outside the model and audit log."}
            </span>
          </div>
          <b>{isArabic ? "رمز تجريبي 2468" : "Demo code\u00a0 2468"}</b>
          <button
            type="button"
            className="otp-escape"
            onClick={() => void requestHumanAgent()}
            disabled={busy}
          >
            {isArabic ? "التحدث مع موظف" : "Talk to an agent"}
          </button>
        </div>
      ) : null}

      <div className="composer-dock">
        <form
          className={`composer ${otpMode ? "otp" : ""}`}
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <input
            aria-label={otpMode ? "Verification code" : "Message"}
            type={otpMode ? "password" : "text"}
            inputMode={otpMode ? "numeric" : "text"}
            maxLength={otpMode ? 4 : 2000}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={otpMode ? "Enter 4-digit code" : "Message in English, العربية, or Arabizi"}
            dir="auto"
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">
            <span>Send</span>
            <b aria-hidden="true">↑</b>
          </button>
        </form>
        <p className="privacy-note">
          Synthetic demo · PII minimized · Actions are server-validated
        </p>
      </div>
    </section>
  );
}

function workflowActionLabel(actions: NonNullable<ChatResponse["suggestedActions"]>): string {
  const type = actions[0]?.action.inputType;
  if (type === "confirm_return") return "Return confirmation";
  if (type === "select_return_item") return "Select return item";
  if (type === "set_return_condition") return "Item condition";
  if (type === "set_return_reason") return "Return reason";
  if (type === "select_intent") return "Choose what to handle first";
  if (type === "continue_intent") return "Continue pending request";
  return "Choose an action";
}
