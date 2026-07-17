import type { ChatInput } from "@/core";
import { z } from "zod";

export const ChatInputSchema: z.ZodType<ChatInput> = z.discriminatedUnion("inputType", [
  z
    .object({
      inputType: z.literal("message"),
      message: z.string().trim().min(1).max(2000)
    })
    .strict(),
  z
    .object({
      inputType: z.literal("submit_otp"),
      code: z.string().regex(/^\d{4}$/)
    })
    .strict(),
  z
    .object({
      inputType: z.literal("select_intent"),
      intent: z.enum(["product_information", "order_tracking"])
    })
    .strict(),
  z
    .object({
      inputType: z.literal("continue_intent"),
      intent: z.enum(["product_information", "order_tracking"])
    })
    .strict(),
  z
    .object({
      inputType: z.literal("select_return_item"),
      itemId: z.string().trim().min(1).max(100)
    })
    .strict(),
  z
    .object({
      inputType: z.literal("set_return_condition"),
      condition: z.enum(["unopened", "opened", "damaged"])
    })
    .strict(),
  z
    .object({
      inputType: z.literal("set_return_reason"),
      reason: z.string().trim().min(3).max(500)
    })
    .strict(),
  z
    .object({
      inputType: z.literal("confirm_return"),
      confirmationToken: z.string().uuid(),
      confirmed: z.boolean()
    })
    .strict(),
  z
    .object({
      inputType: z.literal("set_language"),
      locale: z.enum(["en", "ar"])
    })
    .strict()
]);

export const RequestContextSchema = z
  .object({
    tenantId: z.string().trim().min(1).max(100),
    conversationId: z.string().uuid()
  })
  .strict();

export const ChatRequestSchema = RequestContextSchema.extend({
  input: ChatInputSchema
});
