export class AssistantProviderError extends Error {
  constructor(operation: "understand" | "compose" | "summarize", options?: ErrorOptions) {
    super(`Assistant provider failed during ${operation}`, options);
    this.name = "AssistantProviderError";
  }
}
