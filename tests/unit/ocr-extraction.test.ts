import { describe, it, expect } from 'vitest';
import { extractFieldsFromText } from '@/lib/providers/ocr';

describe('extractFieldsFromText', () => {
  it('extracts merchant, date, amount, invoice number and category from a fuel bill', () => {
    const text = 'Sirsi Highway Fuel Point\nDate: 29/08/2026\nBill No: INV-4521\nPetrol 5 Litres\nTotal: Rs. 550.00\n';
    const fields = extractFieldsFromText(text);
    expect(fields.merchant).toBe('Sirsi Highway Fuel Point');
    expect(fields.date).toBe('2026-08-29');
    expect(fields.amount).toBe(550);
    expect(fields.invoiceNumber).toBe('INV-4521');
    expect(fields.suggestedCategory).toBe('PETROL');
  });

  it('extracts an amount from a rupee symbol when there is no "Total" label', () => {
    const fields = extractFieldsFromText('Some Cafe\n₹120.50 paid\n12/01/2026');
    expect(fields.amount).toBe(120.5);
    expect(fields.suggestedCategory).toBe('FOOD');
  });

  it('extracts a GSTIN when present', () => {
    const fields = extractFieldsFromText('ABC Traders\nGSTIN: 29ABCDE1234F1Z5\nTotal: Rs. 1000');
    expect(fields.gstNumber).toBe('29ABCDE1234F1Z5');
  });

  it('does not fabricate fields that are absent from the text', () => {
    const fields = extractFieldsFromText('unreadable garbled text with no structure');
    expect(fields.amount).toBeUndefined();
    expect(fields.gstNumber).toBeUndefined();
    expect(fields.invoiceNumber).toBeUndefined();
  });

  it('rejects an impossible date rather than guessing', () => {
    const fields = extractFieldsFromText('Total: Rs. 100\nRef 99/99/9999');
    expect(fields.date).toBeUndefined();
  });
});
