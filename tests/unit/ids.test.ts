import { describe, it, expect } from 'vitest';
import { generateOrderNumber, generatePaymentNumber } from '@/lib/ids';

describe('id generators', () => {
  it('generates order numbers with the expected shape', () => {
    const id = generateOrderNumber();
    expect(id).toMatch(/^ORD-\d{8}-\d{5}$/);
  });

  it('generates payment numbers with the expected shape', () => {
    const id = generatePaymentNumber();
    expect(id).toMatch(/^PAY-\d{8}-\d{5}$/);
  });

  it('generates distinct ids across calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateOrderNumber()));
    expect(ids.size).toBe(50);
  });
});
