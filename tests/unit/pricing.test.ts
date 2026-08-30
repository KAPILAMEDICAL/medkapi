import { describe, it, expect } from 'vitest';
import { resolveVisiblePrice, orderingUnitPrice, computeOrderTotals } from '@/lib/pricing';

describe('resolveVisiblePrice', () => {
  const product = { mrp: 100, ptr: 78, pts: 72 };

  it('shows only MRP for MRP_ONLY visibility', () => {
    const result = resolveVisiblePrice(product, 'MRP_ONLY');
    expect(result).toEqual({ mrp: 100, ptr: null, pts: null });
  });

  it('shows MRP + PTR (never PTS) for MRP_AND_PTR visibility', () => {
    const result = resolveVisiblePrice(product, 'MRP_AND_PTR');
    expect(result).toEqual({ mrp: 100, ptr: 78, pts: null });
  });

  it('shows all price fields for ALL_PRICES visibility', () => {
    const result = resolveVisiblePrice(product, 'ALL_PRICES');
    expect(result).toEqual({ mrp: 100, ptr: 78, pts: 72 });
  });

  it('never leaks PTR/PTS even when the caller forgets to redact upstream', () => {
    // Regression guard: a customer with MRP_ONLY must never see trade pricing
    // regardless of what the raw product record contains.
    const result = resolveVisiblePrice({ mrp: 500, ptr: 10, pts: 5 }, 'MRP_ONLY');
    expect(result.ptr).toBeNull();
    expect(result.pts).toBeNull();
  });
});

describe('orderingUnitPrice', () => {
  it('bills at PTR when available', () => {
    expect(orderingUnitPrice({ mrp: 100, ptr: 78 })).toBe(78);
  });

  it('falls back to MRP when no PTR is set', () => {
    expect(orderingUnitPrice({ mrp: 100, ptr: null })).toBe(100);
  });
});

describe('computeOrderTotals', () => {
  it('computes subtotal, tax and grand total for a single line', () => {
    const totals = computeOrderTotals([{ unitPrice: 100, quantity: 2, gstPercent: 12 }]);
    expect(totals.subtotal).toBe(200);
    expect(totals.taxTotal).toBe(24);
    expect(totals.grandTotal).toBe(224);
    expect(totals.lines).toHaveLength(1);
  });

  it('sums multiple lines with different GST rates independently', () => {
    const totals = computeOrderTotals([
      { unitPrice: 50, quantity: 3, gstPercent: 5 }, // 150 + 7.5
      { unitPrice: 200, quantity: 1, gstPercent: 18 }, // 200 + 36
    ]);
    expect(totals.subtotal).toBe(350);
    expect(totals.taxTotal).toBe(43.5);
    expect(totals.grandTotal).toBe(393.5);
  });

  it('rounds to the nearest paise', () => {
    const totals = computeOrderTotals([{ unitPrice: 33.33, quantity: 3, gstPercent: 12 }]);
    expect(totals.subtotal).toBe(99.99);
    expect(Number.isInteger(totals.taxTotal * 100)).toBe(true);
  });

  it('returns zero totals for an empty order', () => {
    const totals = computeOrderTotals([]);
    expect(totals).toEqual({ subtotal: 0, taxTotal: 0, grandTotal: 0, lines: [] });
  });
});
