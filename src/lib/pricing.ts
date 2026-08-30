import type { PriceVisibility } from '@prisma/client';
import { Prisma } from '@prisma/client';

export interface PriceView {
  mrp: number;
  ptr: number | null;
  pts: number | null;
}

/**
 * Redacts trade pricing a customer is not authorized to see (Master
 * Prompt §9/§27: "never expose sensitive internal pricing to customers
 * unless authorized"). MRP is always shown; PTR/PTS are gated by the
 * customer's `priceVisibility` setting, controlled by the admin.
 */
export function resolveVisiblePrice(
  product: { mrp: Prisma.Decimal | number; ptr: Prisma.Decimal | number | null; pts: Prisma.Decimal | number | null },
  visibility: PriceVisibility,
): PriceView {
  const mrp = Number(product.mrp);
  if (visibility === 'ALL_PRICES') {
    return { mrp, ptr: product.ptr !== null ? Number(product.ptr) : null, pts: product.pts !== null ? Number(product.pts) : null };
  }
  if (visibility === 'MRP_AND_PTR') {
    return { mrp, ptr: product.ptr !== null ? Number(product.ptr) : null, pts: null };
  }
  return { mrp, ptr: null, pts: null };
}

/**
 * The price actually used to book an order line. Wholesale ordering
 * bills at PTR (price to retailer) when available, falling back to MRP —
 * a customer never pays more than what they're shown, and never sees a
 * price field they aren't authorized to view.
 */
export function orderingUnitPrice(product: { mrp: Prisma.Decimal | number; ptr: Prisma.Decimal | number | null }): number {
  return product.ptr !== null && product.ptr !== undefined ? Number(product.ptr) : Number(product.mrp);
}

export interface OrderLineInput {
  unitPrice: number;
  quantity: number;
  gstPercent: number;
}

export interface OrderTotals {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  lines: { lineTotal: number; taxAmount: number }[];
}

/** Computes subtotal/tax/grand-total for an order, rounded to paise. */
export function computeOrderTotals(lines: OrderLineInput[]): OrderTotals {
  let subtotal = 0;
  let taxTotal = 0;
  const lineResults = lines.map((l) => {
    const base = round2(l.unitPrice * l.quantity);
    const tax = round2(base * (l.gstPercent / 100));
    subtotal += base;
    taxTotal += tax;
    return { lineTotal: base, taxAmount: tax };
  });
  return {
    subtotal: round2(subtotal),
    taxTotal: round2(taxTotal),
    grandTotal: round2(subtotal + taxTotal),
    lines: lineResults,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
