const INSTRUCTION_OVERRIDE_PATTERNS = [
  /\b(?:ignore|disregard|override|bypass)\b.{0,80}\b(?:previous|prior|system|developer|policy|rules?|instructions?)\b/is,
  /\b(?:system|developer)\s+(?:message|prompt|instructions?)\b/i,
  /\b(?:reveal|expose|print)\b.{0,80}\b(?:secret|prompt|credentials?|api[- ]?key|customer data)\b/is,
  /(?:تجاهل|تجاوز).{0,80}(?:التعليمات|القواعد|السياسة|رسالة النظام)/s,
  /(?:اكشف|اعرض).{0,80}(?:السر|المفتاح|بيانات العميل|تعليمات النظام)/s
];

export function isSafeKnowledgeContent(content: string): boolean {
  return !INSTRUCTION_OVERRIDE_PATTERNS.some((pattern) => pattern.test(content));
}
