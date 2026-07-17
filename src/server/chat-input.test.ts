import { describe, expect, it } from "vitest";
import { ChatInputSchema } from "./chat-input";

describe("structured chat input", () => {
  it("accepts stable actions and requires explicit return confirmation", () => {
    expect(
      ChatInputSchema.parse({
        inputType: "select_return_item",
        itemId: "ITEM-F-02"
      })
    ).toEqual({ inputType: "select_return_item", itemId: "ITEM-F-02" });
    const confirmationToken = crypto.randomUUID();
    expect(
      ChatInputSchema.safeParse({
        inputType: "confirm_return",
        confirmationToken,
        confirmed: true
      }).success
    ).toBe(true);
    expect(
      ChatInputSchema.safeParse({ inputType: "confirm_return", confirmationToken }).success
    ).toBe(false);
  });

  it("keeps OTP values in the dedicated secure input variant", () => {
    expect(ChatInputSchema.safeParse({ inputType: "submit_otp", code: "2468" }).success).toBe(true);
    expect(ChatInputSchema.safeParse({ inputType: "message", code: "2468" }).success).toBe(false);
    expect(
      ChatInputSchema.safeParse({
        inputType: "message",
        message: "Track my order",
        code: "2468"
      }).success
    ).toBe(false);
    expect(ChatInputSchema.safeParse({ inputType: "submit_otp", code: "24 68" }).success).toBe(
      false
    );
  });
});
