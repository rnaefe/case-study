import type { Product } from "../types";

export function findRequestedVariant(product: Product, requestedLabel: string | undefined) {
  if (!requestedLabel) return undefined;
  const normalized = requestedLabel.trim().toLocaleLowerCase();
  return product.variants.find(
    (variant) => variant.label.trim().toLocaleLowerCase() === normalized
  );
}

export function groupVariantsByStock(product: Product) {
  return {
    available: product.variants.filter((variant) => variant.stock > 0),
    unavailable: product.variants.filter((variant) => variant.stock <= 0)
  };
}
