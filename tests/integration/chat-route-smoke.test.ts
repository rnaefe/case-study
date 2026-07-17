import { describe, expect, it } from "vitest";
import type { ChatResponse } from "@/core";
import { createChatPost } from "@/app/api/chat/route";
import { createRuntime } from "@/server/runtime";
import { ScriptedAssistantModel, understanding } from "../support/scripted-assistant-model";

function request(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("chat route smoke", () => {
  it("runs Arabizi tracking and OTP through the real HTTP handler", async () => {
    const conversationId = crypto.randomUUID();
    const model = new ScriptedAssistantModel([
      understanding({
        intent: "order_tracking",
        detectedLocale: "arabizi",
        responseLocale: "ar",
        entities: { orderId: "ORD-1001" }
      })
    ]);
    const post = createChatPost((tenantId) => createRuntime(tenantId, { model }));

    const challengeResponse = await post(
      request({
        tenantId: "ksa-fashion",
        conversationId,
        input: { inputType: "message", message: "wen talabi ORD-1001" }
      })
    );
    const challenge = (await challengeResponse.json()) as ChatResponse;

    expect(challengeResponse.status).toBe(200);
    expect(challenge.state.phase).toBe("awaiting_verification");
    expect(challenge.direction).toBe("rtl");
    expect(challenge.demoOtpAvailable).toBe(true);
    expect(JSON.stringify(challenge)).not.toContain("Riyadh hub");

    const trackingResponse = await post(
      request({
        tenantId: "ksa-fashion",
        conversationId,
        input: { inputType: "submit_otp", code: "2468" }
      })
    );
    const tracking = (await trackingResponse.json()) as ChatResponse;

    expect(trackingResponse.status).toBe(200);
    expect(tracking.state.phase).toBe("resolved");
    expect(tracking.events.map((event) => event.label)).toEqual(
      expect.arrayContaining([
        "Order verified",
        "Mock Medusa order lookup",
        "Mock Aramex tracking lookup"
      ])
    );
    expect(JSON.stringify(tracking)).not.toContain("2468");
  });
});
