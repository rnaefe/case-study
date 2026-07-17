import type { RedactedMessage } from "@/core";
import { OpenAIAssistantModel, type OpenAIUsageSample } from "@/server/openai-assistant-model";
import { getOpenAIModel } from "@/server/openai-config";
import { assertComposition, assertUnderstanding } from "./assertions";
import { modelCases } from "./cases";
import { estimatedCost, loadModelEnvironment, selectedTag } from "./support";

async function main(): Promise<void> {
  loadModelEnvironment();
  const tag = selectedTag();
  const cases = tag ? modelCases.filter((item) => item.tags.includes(tag as never)) : modelCases;
  if (!cases.length) throw new Error(`No model cases match tag: ${tag}`);

  const usage: OpenAIUsageSample = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let requests = 0;
  const model = new OpenAIAssistantModel({
    onUsage(sample) {
      usage.inputTokens += sample.inputTokens;
      usage.outputTokens += sample.outputTokens;
      usage.totalTokens += sample.totalTokens;
      requests += 1;
    }
  });
  const failures: string[] = [];
  let passed = 0;

  console.log(`Model evaluation: ${cases.length} case(s)${tag ? `, tag ${tag}` : ""}`);
  for (const item of cases) {
    const recentMessages: RedactedMessage[] = (item.recentMessages ?? []).map((message, index) => ({
      ...message,
      createdAt: new Date(Date.now() + index).toISOString()
    }));
    const caseFailures: string[] = [];
    try {
      const actual = await model.understand({
        text: item.text,
        locale: item.expected.responseLocale,
        recentMessages
      });
      caseFailures.push(...assertUnderstanding(actual, item.expected));
      if (item.compose) {
        const message = await model.composeResponse({
          locale: item.compose.locale,
          intent: item.compose.intent,
          userText: item.text,
          evidence: item.compose.evidence,
          groundedDraft: item.compose.groundedDraft
        });
        caseFailures.push(...assertComposition(message, item.compose));
      }
    } catch (error) {
      caseFailures.push(error instanceof Error ? error.message : "Unknown provider error");
    }
    console.log(`${caseFailures.length ? "FAIL" : "PASS"} ${item.id}`);
    if (!caseFailures.length) passed += 1;
    failures.push(...caseFailures.map((failure) => `${item.id}: ${failure}`));
  }

  console.log(`Result: ${passed}/${cases.length} passed with ${getOpenAIModel()}`);
  console.log(
    `Usage: ${requests} request(s), ${usage.inputTokens} input / ${usage.outputTokens} output; estimated $${estimatedCost(usage).toFixed(6)}`
  );
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  }
}

void main();
