import type { UnderstandingResult } from "@/core";
import type { ModelCase } from "./support";

function containsShape(actual: unknown, expected: unknown): boolean {
  if (expected === undefined) return true;
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && expected.every((value) => actual.includes(value));
  }
  if (typeof expected === "object" && expected !== null) {
    if (typeof actual !== "object" || actual === null) return false;
    return Object.entries(expected).every(([key, value]) =>
      containsShape((actual as Record<string, unknown>)[key], value)
    );
  }
  return actual === expected;
}

export function assertUnderstanding(
  actual: UnderstandingResult,
  expected: ModelCase["expected"]
): string[] {
  const failures: string[] = [];
  if (actual.intent !== expected.intent) failures.push(`intent=${actual.intent}`);
  if (!containsShape(actual.intents, expected.intents)) failures.push(`intents=${actual.intents}`);
  if (actual.detectedLocale !== expected.detectedLocale) {
    failures.push(`detectedLocale=${actual.detectedLocale}`);
  }
  if (actual.responseLocale !== expected.responseLocale) {
    failures.push(`responseLocale=${actual.responseLocale}`);
  }
  if (actual.readiness !== expected.readiness) failures.push(`readiness=${actual.readiness}`);
  if (!containsShape(actual.entities, expected.entities)) failures.push("entities mismatch");
  if (!containsShape(actual.escalation, expected.escalation)) failures.push("escalation mismatch");
  if (!containsShape(actual.conversation, expected.conversation)) {
    failures.push("conversation context mismatch");
  }
  return failures;
}

export function assertComposition(
  message: string,
  expected: NonNullable<ModelCase["compose"]>
): string[] {
  const normalized = message.toLocaleLowerCase();
  const failures = expected.includes
    .filter((value) => !normalized.includes(value.toLocaleLowerCase()))
    .map((value) => `response missing ${value}`);
  for (const value of expected.excludes ?? []) {
    if (normalized.includes(value.toLocaleLowerCase())) failures.push(`response contains ${value}`);
  }
  return failures;
}
