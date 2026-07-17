import { expect, test, type Page, type Route } from "@playwright/test";

type ChatRequest = {
  tenantId: string;
  input: { inputType: "message"; message: string } | { inputType: "submit_otp"; code: string };
};

type StubResponse = {
  message: string;
  phase?: string;
  direction?: "ltr" | "rtl";
  sources?: Array<{ id: string; label: string }>;
  events?: Array<{ label: string; detail?: string }>;
  demoOtpAvailable?: boolean;
};

let eventSequence = 0;

async function mockChat(
  page: Page,
  handler: (request: ChatRequest) => StubResponse | Promise<StubResponse>
) {
  await page.route("**/api/chat", async (route) => {
    const request = route.request().postDataJSON() as ChatRequest;
    await fulfill(route, await handler(request));
  });
}

async function fulfill(route: Route, response: StubResponse) {
  const events = (response.events ?? []).map((event, index) => ({
    id: `event-${eventSequence++}-${index}`,
    type: "tool_call",
    label: event.label,
    detail: event.detail ?? "Safe synthetic event",
    createdAt: new Date().toISOString()
  }));
  await route.fulfill({
    json: {
      outcome: response.demoOtpAvailable ? "action_required" : "answered",
      message: response.message,
      direction: response.direction ?? "ltr",
      state: {
        phase: response.phase ?? "resolved",
        verificationFailureCount: 0,
        selfServiceFailureCount: 0,
        messages: []
      },
      events,
      sources: response.sources ?? [],
      demoOtpAvailable: response.demoOtpAvailable
    }
  });
}

async function send(page: Page, message: string) {
  const assistantMessages = await page.locator(".message.assistant").count();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(message);
  await page.getByLabel("Send message").click();
  await expect(page.locator(".message.assistant")).toHaveCount(assistantMessages + 1);
}

test("submits a product question and renders its source", async ({ page }) => {
  await mockChat(page, () => ({
    message: "Linen Wrap Dress: size M is in stock with 4 units. Price: SAR 329.",
    sources: [{ id: "F-DRESS-01", label: "Linen Wrap Dress · catalog" }],
    events: [{ label: "Catalog search" }]
  }));
  await page.goto("/t/ksa-fashion");

  await send(page, "Is the linen dress available in medium?");

  await expect(page.getByText(/size M is in stock with 4 units/)).toBeVisible();
  await expect(page.getByText(/Linen Wrap Dress.*catalog/)).toBeVisible();
});

test("uses the secure OTP field once and treats thanks as conversation", async ({ page }) => {
  await mockChat(page, ({ input }) => {
    if (input.inputType === "submit_otp") {
      return {
        message: "Order ORD-1001 is in transit. Expected delivery: 2026-07-19.",
        events: [{ label: "Order verified" }, { label: "Mock Aramex tracking lookup" }]
      };
    }
    if (input.message.toLowerCase().includes("thank")) {
      return { message: "You're welcome! I'm here if you need anything else." };
    }
    return {
      message:
        "We sent a verification code to the phone linked to ORD-1001. Enter it in the secure field.",
      phase: "awaiting_verification",
      demoOtpAvailable: true,
      events: [{ label: "Verification challenge" }]
    };
  });
  await page.goto("/t/ksa-fashion");

  await send(page, "Track order ORD-1001");
  await expect(page.getByLabel("Verification code", { exact: true })).toBeVisible();
  await page.getByLabel("Verification code", { exact: true }).fill("2468");
  await page.getByLabel("Send message").click();
  await expect(page.getByText(/Expected delivery: 2026-07-19/)).toBeVisible();

  await send(page, "Thanks!");

  await expect(page.locator(".message.assistant").last()).toContainText(/welcome/i);
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Verification code", { exact: true })).not.toBeVisible();
});

test("switches tenant and opens the trace on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockChat(page, ({ tenantId }) =>
    tenantId === "ksa-fashion"
      ? {
          message: "Linen Wrap Dress is available.",
          sources: [{ id: "F-DRESS-01", label: "Linen Wrap Dress · catalog" }]
        }
      : {
          message: "Sahm Wireless Earbuds are available.",
          sources: [{ id: "E-EARBUD-01", label: "Sahm Wireless Earbuds · catalog" }],
          events: [{ label: "Tenant-scoped catalog search" }]
        }
  );
  await page.goto("/t/ksa-fashion");
  await send(page, "Is the linen dress available?");

  await page.getByLabel("Select tenant").selectOption("ksa-electronics");
  await expect(page).toHaveURL(/\/t\/ksa-electronics$/);
  await send(page, "Are the wireless earbuds available?");
  await expect(page.getByText(/Sahm Wireless Earbuds.*catalog/)).toBeVisible();
  await expect(page.getByText(/Linen Wrap Dress.*catalog/)).not.toBeVisible();

  await page.getByRole("button", { name: "View trace" }).click();
  await expect(page.getByText("Safe execution trace")).toBeInViewport();
  await expect(page.getByText("Tenant-scoped catalog search")).toBeVisible();
});

test("offers a retry after a failed request", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/chat", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.abort("failed");
      return;
    }
    await fulfill(route, { message: "Linen Wrap Dress is available." });
  });
  await page.goto("/t/ksa-fashion");

  await send(page, "Is the linen dress available?");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();

  await expect(page.getByText("Linen Wrap Dress is available.")).toBeVisible();
});
