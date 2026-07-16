import type { OrderItem, ReturnEligibility, ReturnPolicy } from "../types";

export function evaluateReturn(
  policy: ReturnPolicy,
  item: OrderItem,
  deliveredAt: string | undefined,
  now = new Date()
): ReturnEligibility {
  if (!deliveredAt) {
    return {
      eligible: false,
      requiresHumanReview: false,
      reason: "The order has not been delivered yet.",
      reasonAr: "الطلب لم يتم تسليمه بعد."
    };
  }
  const elapsed = Math.floor((now.getTime() - new Date(deliveredAt).getTime()) / 86_400_000);
  if (elapsed > policy.returnWindowDays) {
    return {
      eligible: false,
      requiresHumanReview: false,
      reason: `The ${policy.returnWindowDays}-day return window has passed.`,
      reasonAr: `انتهت مهلة الإرجاع البالغة ${policy.returnWindowDays} أيام.`
    };
  }
  if (policy.finalSaleExcluded && item.finalSale) {
    return {
      eligible: false,
      requiresHumanReview: false,
      reason: "Final-sale items are not eligible for return.",
      reasonAr: "منتجات التخفيض النهائي غير قابلة للإرجاع."
    };
  }
  if (policy.damagedItemsRequireReview && item.damaged) {
    return {
      eligible: false,
      requiresHumanReview: true,
      reason: "Damaged items require review by the CX team.",
      reasonAr: "المنتجات التالفة تحتاج مراجعة فريق خدمة العملاء."
    };
  }
  if (policy.openedItemsRequireReview && item.opened) {
    return {
      eligible: false,
      requiresHumanReview: true,
      reason: "Opened items require review by the CX team.",
      reasonAr: "المنتجات المفتوحة تحتاج مراجعة فريق خدمة العملاء."
    };
  }
  return {
    eligible: true,
    requiresHumanReview: false,
    reason: `Eligible within the ${policy.returnWindowDays}-day return window.`,
    reasonAr: `المنتج مؤهل ضمن مهلة الإرجاع البالغة ${policy.returnWindowDays} أيام.`
  };
}
