import type { HandoffReason, ResponseLocale } from "../types";

export function routingFor(reason: HandoffReason) {
  if (["payment_dispute", "refund_request", "vip_customer", "out_of_policy"].includes(reason)) {
    return { urgency: "high" as const, priority: 1, recommendedTier: "cx_manager" as const };
  }
  if (
    [
      "complaint",
      "critical_safety",
      "failed_self_service",
      "verification_failed_twice",
      "delivery_exception"
    ].includes(reason)
  ) {
    return { urgency: "high" as const, priority: 2, recommendedTier: "supervisor" as const };
  }
  if (reason === "provider_failure") {
    return { urgency: "medium" as const, priority: 2, recommendedTier: "admin" as const };
  }
  return { urgency: "medium" as const, priority: 3, recommendedTier: "agent" as const };
}

export function handoffReasonLabel(reason: HandoffReason, locale: ResponseLocale) {
  if (locale === "en") return reason.replaceAll("_", " ");
  const labels: Record<HandoffReason, string> = {
    explicit_request: "طلب موظف بشري",
    refund_request: "طلب استرداد مالي",
    cancellation_request: "طلب إلغاء",
    address_change_request: "طلب تغيير العنوان",
    complaint: "شكوى أو غضب",
    payment_dispute: "اعتراض على عملية دفع",
    critical_safety: "إشارة سلامة حرجة",
    vip_customer: "عميل VIP",
    out_of_policy: "طلب خارج السياسة أو يحتاج مراجعة",
    unsupported_action: "إجراء غير مدعوم",
    insufficient_knowledge: "معلومات غير كافية",
    failed_self_service: "فشل الخدمة الذاتية مرتين",
    verification_failed_twice: "فشل التحقق مرتين",
    provider_failure: "تعطل مزود النموذج",
    delivery_exception: "استثناء في التوصيل"
  };
  return labels[reason];
}
