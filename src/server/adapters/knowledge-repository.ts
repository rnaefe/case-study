import type { KnowledgeDocument, KnowledgeRepository, RequestContext } from "@/core";
import type { TenantData } from "../tenants";
import { assertTenant } from "./tenant-boundary";

export class TenantKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly tenant: TenantData) {}

  async findApprovedByCategory(
    context: RequestContext,
    category: KnowledgeDocument["category"],
    locale: "en" | "ar"
  ) {
    const eligible = this.approved(context)
      .filter((doc) => doc.category === category && (doc.locale === locale || doc.locale === "en"))
      .sort(
        (a, b) => Number(b.locale === locale) - Number(a.locale === locale) || b.version - a.version
      );
    return structuredClone(eligible);
  }

  async searchApproved(context: RequestContext, query: string) {
    const locale = /[\u0600-\u06FF]/.test(query) ? "ar" : "en";
    const eligible = this.approved(context).filter(
      (doc) => doc.locale === locale || doc.locale === "en"
    );
    const normalized = query.toLowerCase();
    const genericKeywords = new Set(["when", "متى"]);
    const ranked = eligible
      .map((doc) => ({
        doc,
        score: doc.keywords.reduce((score, keyword) => {
          const normalizedKeyword = keyword.toLowerCase();
          if (genericKeywords.has(normalizedKeyword)) return score;
          return normalized.includes(normalizedKeyword) ? score + normalizedKeyword.length : score;
        }, 0)
      }))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score || b.doc.version - a.doc.version)
      .map((match) => match.doc);
    return structuredClone(ranked);
  }

  private approved(context: RequestContext): KnowledgeDocument[] {
    assertTenant(context, this.tenant);
    const now = Date.now();
    return this.tenant.knowledge.filter((doc) => {
      const effective = new Date(doc.effectiveFrom).getTime() <= now;
      const notExpired = !doc.effectiveUntil || new Date(doc.effectiveUntil).getTime() >= now;
      return (
        doc.tenantId === context.tenantId &&
        doc.status === "approved" &&
        effective &&
        notExpired
      );
    });
  }
}
