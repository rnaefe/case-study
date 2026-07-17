import {
  rememberProduct,
  requestClarification,
  resolveIntent,
  type WorkflowResult
} from "../conversation/transitions";
import type { SupportRuntime } from "../orchestration/runtime";
import { findRequestedVariant, groupVariantsByStock } from "../product/variant-matching";
import type {
  AuditEvent,
  ConversationState,
  EvidenceSource,
  Intent,
  RequestContext,
  UnderstandingResult
} from "../types";
import { event, redactPii } from "../utils";
import { HandoffWorkflow } from "./handoff-workflow";

export class ProductWorkflow {
  constructor(
    private readonly runtime: SupportRuntime,
    private readonly handoff: HandoffWorkflow
  ) {}

  async handle(
    context: RequestContext,
    state: ConversationState,
    text: string,
    understanding: UnderstandingResult,
    events: AuditEvent[],
    sources: EvidenceSource[],
    intent: Extract<Intent, "product_information" | "return_policy_information">
  ): Promise<WorkflowResult> {
    if (
      intent === "product_information" &&
      understanding.entities.productQuestionType === "discovery"
    ) {
      return this.discover(context, state, understanding, events, sources);
    }

    const preferredProductId = understanding.conversation.refersToPreviousProduct
      ? state.productContext?.productId
      : undefined;
    const productQuery = preferredProductId
      ? preferredProductId
      : (understanding.entities.productReference ?? text);
    const knowledgeCategory = this.knowledgeCategory(understanding, intent);
    const [products, docs] = await Promise.all([
      this.runtime.commerce.searchProducts(context, productQuery),
      knowledgeCategory
        ? this.runtime.knowledge.findApprovedByCategory(
            context,
            knowledgeCategory,
            state.preferredResponseLocale ?? "en"
          )
        : Promise.resolve([])
    ]);
    events.push(event("tool_call", "Catalog search", `${products.length} tenant-scoped result(s)`));
    events.push(
      event("knowledge", "Approved knowledge search", `${docs.length} effective source(s)`)
    );

    if (knowledgeCategory && !docs.length) {
      return this.handoff.create(context, state, "insufficient_knowledge", events);
    }
    if (
      !products.length &&
      !docs.length &&
      intent === "product_information" &&
      understanding.entities.productReference
    ) {
      return this.clarifyUnknownProduct(
        context,
        state,
        understanding.entities.productReference,
        events,
        sources
      );
    }
    if (!products.length && !docs.length) {
      return this.handoff.create(context, state, "insufficient_knowledge", events);
    }

    const product = products[0];
    const doc = docs[0];
    const requestedVariant = understanding.entities.requestedVariant;
    const ar = state.preferredResponseLocale === "ar";
    const segments: string[] = [];
    let isUnavailable = false;
    if (product) {
      rememberProduct(
        state,
        product,
        understanding.entities.productReference ?? product.id,
        requestedVariant
      );
      sources.push({ id: product.id, label: `${product.name} · catalog` });
      const requested = findRequestedVariant(product, requestedVariant);
      const { available, unavailable } = groupVariantsByStock(product);

      if (requestedVariant && !requested) {
        segments.push(
          ar
            ? `${product.nameAr}: المقاس ${requestedVariant} غير موجود ضمن الخيارات المسجلة. المتوفر حالياً: ${available.map((variant) => `${variant.label} (${variant.stock})`).join("، ") || "لا يوجد"}. غير المتوفر: ${unavailable.map((variant) => variant.label).join("، ") || "لا يوجد"}. السعر ${product.priceSar} ر.س.`
            : `${product.name}: ${requestedVariant} is not listed as an available variant. Currently available: ${available.map((variant) => `${variant.label} (${variant.stock})`).join(", ") || "none"}. Out of stock: ${unavailable.map((variant) => variant.label).join(", ") || "none"}. Price: SAR ${product.priceSar}.`
        );
      } else if (requested) {
        segments.push(
          ar
            ? `${product.nameAr}: المقاس ${requested.label} ${requested.stock > 0 ? `متوفر، والكمية ${requested.stock}` : "غير متوفر حالياً"}. السعر ${product.priceSar} ر.س. ${product.descriptionAr}`
            : `${product.name}: size ${requested.label} is ${requested.stock > 0 ? `in stock with ${requested.stock} unit${requested.stock === 1 ? "" : "s"}` : "currently out of stock"}. Price: SAR ${product.priceSar}. ${product.description}`
        );
      } else {
        const stock = product.variants
          .map(
            (variant) =>
              `${variant.label}: ${
                variant.stock > 0
                  ? ar
                    ? `متوفر (${variant.stock})`
                    : `in stock (${variant.stock})`
                  : ar
                    ? "غير متوفر"
                    : "out of stock"
              }`
          )
          .join(" · ");
        segments.push(
          ar
            ? `${product.nameAr}: ${product.descriptionAr} السعر ${product.priceSar} ر.س. ${stock}`
            : `${product.name}: ${product.description} SAR ${product.priceSar}. ${stock}`
        );
      }
      if (
        understanding.entities.productQuestionType === "restock" &&
        (!requested || requested.stock === 0)
      ) {
        isUnavailable = true;
        segments.push(
          ar ? "لا يوجد موعد مؤكد لإعادة التوفر." : "No confirmed restock date is available."
        );
      }
    }

    if (doc) {
      sources.push({ id: doc.id, label: doc.title });
      segments.push(doc.content);
    }
    resolveIntent(state, intent, events);
    const groundedDraft = segments.join("\n\n");
    const message = await this.runtime.model.composeResponse({
      locale: state.preferredResponseLocale ?? "en",
      intent,
      userText: redactPii(text),
      evidence: [...(product ? [JSON.stringify(product)] : []), ...(doc ? [doc.content] : [])],
      groundedDraft
    });
    events.push(
      event(
        "tool_call",
        "Localized response composition",
        "Model composed from tenant-scoped grounded evidence."
      )
    );
    return {
      kind: isUnavailable ? "unavailable" : "answered",
      message,
      suggestedReplies: ar
        ? ["وين طلبي؟", "سياسة الإرجاع"]
        : ["Track my order", "What is the return policy?"]
    };
  }

  private knowledgeCategory(
    understanding: UnderstandingResult,
    intent: Extract<Intent, "product_information" | "return_policy_information">
  ) {
    if (intent === "return_policy_information") return "returns" as const;
    switch (understanding.entities.productQuestionType) {
      case "shipping":
        return "shipping" as const;
      case "cod":
        return "cod" as const;
      case "returnability":
        return "returns" as const;
      default:
        return undefined;
    }
  }

  private async discover(
    context: RequestContext,
    state: ConversationState,
    understanding: UnderstandingResult,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    const products = await this.runtime.commerce.listProducts(context);
    events.push(
      event("tool_call", "Catalog discovery", `${products.length} tenant-scoped product(s)`)
    );
    if (!products.length) {
      return this.handoff.create(context, state, "insufficient_knowledge", events);
    }
    const ar = state.preferredResponseLocale === "ar";
    for (const product of products) {
      sources.push({ id: product.id, label: `${product.name} · catalog` });
    }
    requestClarification(
      state,
      "awaiting_product_clarification",
      {
        type: "product_reference",
        originalText: "catalog discovery",
        options: products.map((product) => product.id)
      },
      events,
      understanding
    );
    const groundedDraft = ar
      ? `المنتجات المتاحة: ${products
          .map((product) => `${product.nameAr} (${product.priceSar} ر.س)`)
          .join("، ")}. أي منتج تبغى تعرف عنه أكثر؟`
      : `Available products: ${products
          .map((product) => `${product.name} (SAR ${product.priceSar})`)
          .join(", ")}. Which product would you like to inspect?`;
    const message = await this.runtime.model.composeResponse({
      locale: state.preferredResponseLocale ?? "en",
      intent: "product_information",
      userText: "Tenant catalog discovery",
      evidence: products.map((product) => JSON.stringify(product)),
      groundedDraft
    });
    return {
      kind: "clarification_required",
      message,
      suggestedReplies: products.map((product) => (ar ? product.nameAr : product.name))
    };
  }

  private async clarifyUnknownProduct(
    context: RequestContext,
    state: ConversationState,
    requestedProduct: string,
    events: AuditEvent[],
    sources: EvidenceSource[]
  ): Promise<WorkflowResult> {
    const products = await this.runtime.commerce.listProducts(context);
    if (!products.length) {
      return this.handoff.create(context, state, "insufficient_knowledge", events);
    }
    for (const product of products) {
      sources.push({ id: product.id, label: `${product.name} · catalog` });
    }
    requestClarification(
      state,
      "awaiting_product_clarification",
      {
        type: "product_reference",
        originalText: requestedProduct,
        options: products.map((product) => product.id)
      },
      events
    );
    const ar = state.preferredResponseLocale === "ar";
    return {
      kind: "clarification_required",
      message: ar
        ? `ما لقيت منتجاً مطابقاً في كتالوج هذا المتجر. المتاح: ${products.map((product) => product.nameAr).join("، ")}. أي واحد تقصد؟`
        : `I couldn't match that product in this tenant's catalog. Available products are ${products.map((product) => product.name).join(", ")}. Which one do you mean?`,
      suggestedReplies: products.map((product) => (ar ? product.nameAr : product.name))
    };
  }
}
