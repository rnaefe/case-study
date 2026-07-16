import type { ApplicationOutcome, ChatActionInput, SupportTicket } from "./types";

type ResultDetails = {
  message: string;
  suggestedReplies?: string[];
  demoOtpAvailable?: boolean;
  suggestedActions?: Array<{
    label: string;
    action: ChatActionInput;
  }>;
};

export type ApplicationResult =
  | ({ kind: "answered" } & ResultDetails)
  | ({ kind: "clarification_required" } & ResultDetails)
  | ({ kind: "action_required" } & ResultDetails)
  | ({ kind: "handoff_required"; ticket: SupportTicket } & ResultDetails)
  | ({ kind: "unavailable" } & ResultDetails)
  | ({ kind: "provider_failure"; ticket: SupportTicket } & ResultDetails);

export type ApplicationResultOf<Kind extends ApplicationOutcome> = Extract<
  ApplicationResult,
  { kind: Kind }
>;
