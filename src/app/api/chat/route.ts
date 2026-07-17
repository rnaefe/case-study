import { NextResponse } from "next/server";
import type { SupportOrchestrator } from "@/core";
import { createRuntime } from "@/server/runtime";
import { OpenAIConfigurationError } from "@/server/openai-assistant-model";
import { ChatRequestSchema } from "@/server/chat-input";

type RuntimeFactory = (tenantId: string) => SupportOrchestrator | null;

export function createChatPost(runtimeFactory: RuntimeFactory = createRuntime) {
  return async function post(request: Request) {
    const body = await request.json().catch(() => undefined);
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    let runtime;
    try {
      runtime = runtimeFactory(parsed.data.tenantId);
    } catch (error) {
      if (error instanceof OpenAIConfigurationError) {
        return NextResponse.json({ error: "OpenAI is not configured" }, { status: 503 });
      }
      throw error;
    }
    if (!runtime) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
    const response = await runtime.chat(
      {
        tenantId: parsed.data.tenantId,
        conversationId: parsed.data.conversationId
      },
      parsed.data.input
    );
    return NextResponse.json(response);
  };
}

export const POST = createChatPost();
