const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
}

export function isModelConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
