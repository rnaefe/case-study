import { describe, expect, it } from "vitest";
import { directionFor, evaluateReturn, redactPii } from "./utils";

describe("support-core utilities", () => {
  it("renders direction and redacts sensitive input", () => {
    expect(directionFor("ar")).toBe("rtl");
    expect(directionFor("arabizi")).toBe("ltr");
    expect(directionFor("en")).toBe("ltr");
    const result = redactPii("Call 0551234567, mail me@example.com, OTP 2468");
    expect(result).not.toContain("0551234567");
    expect(result).not.toContain("me@example.com");
    expect(result).not.toContain("2468");
    expect(result).toContain("[PHONE_REDACTED]");
  });

  it("keeps dates and order references intact while redacting bare codes", () => {
    const result = redactPii("Order ORD-1001 delivered on 2026-07-19; code 2468");
    expect(result).toContain("ORD-1001");
    expect(result).toContain("2026-07-19");
    expect(result).not.toContain("2468");
    expect(result).toContain("[CODE_REDACTED]");
  });

  it("evaluates policy deterministically", () => {
    const policy = {
      returnWindowDays: 14,
      finalSaleExcluded: true,
      openedItemsRequireReview: false,
      damagedItemsRequireReview: true,
      conditions: [],
      conditionsAr: []
    };
    const normal = evaluateReturn(
      policy,
      { id: "1", productId: "p", name: "Product", quantity: 1, unitPriceSar: 10 },
      new Date(Date.now() - 5 * 86_400_000).toISOString()
    );
    const finalSale = evaluateReturn(
      policy,
      {
        id: "2",
        productId: "p",
        name: "Product",
        quantity: 1,
        unitPriceSar: 10,
        finalSale: true
      },
      new Date(Date.now() - 5 * 86_400_000).toISOString()
    );
    expect(normal.eligible).toBe(true);
    expect(finalSale.eligible).toBe(false);
  });
});
