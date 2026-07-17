import { NextResponse } from "next/server";
import { resetConversation } from "@/server/runtime";
import { RequestContextSchema } from "@/server/chat-input";

export async function POST(request: Request) {
  const parsed = RequestContextSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const cleared = await resetConversation(parsed.data);
  if (!cleared) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
