import { describe, it, expect } from 'vitest';
import {
  mobileSchema,
  otpCodeSchema,
  customerRegistrationSchema,
  orderBookingSchema,
  expenseEntrySchema,
  expenseCategoryCreateSchema,
  expenseLocationSchema,
} from '@/lib/validation';

describe('mobileSchema', () => {
  it('accepts a plain 10-digit mobile number', () => {
    expect(mobileSchema.parse('9900001001')).toBe('9900001001');
  });

  it('normalizes +91 / 91 / 0 prefixes', () => {
    expect(mobileSchema.parse('+919900001001')).toBe('9900001001');
    expect(mobileSchema.parse('919900001001')).toBe('9900001001');
    expect(mobileSchema.parse('09900001001')).toBe('9900001001');
  });

  it('rejects a number that does not start with 6-9', () => {
    expect(() => mobileSchema.parse('5900001001')).toThrow();
  });

  it('rejects a too-short number', () => {
    expect(() => mobileSchema.parse('12345')).toThrow();
  });
});

describe('otpCodeSchema', () => {
  it('accepts a 6-digit code', () => {
    expect(otpCodeSchema.parse('123456')).toBe('123456');
  });

  it('rejects a code with letters', () => {
    expect(() => otpCodeSchema.parse('12a456')).toThrow();
  });

  it('rejects a code of the wrong length', () => {
    expect(() => otpCodeSchema.parse('12345')).toThrow();
  });
});

describe('customerRegistrationSchema', () => {
  const valid = {
    firmName: 'Sirsi City Medicals',
    ownerName: 'Anand Shet',
    mobile: '9900001001',
    address: 'Main Road',
    city: 'Sirsi',
    pincode: '581401',
  };

  it('accepts a minimal valid registration', () => {
    const result = customerRegistrationSchema.parse(valid);
    expect(result.customerType).toBe('PHARMACY'); // default applied
  });

  it('rejects an invalid pincode', () => {
    expect(() => customerRegistrationSchema.parse({ ...valid, pincode: '123' })).toThrow();
  });

  it('rejects an invalid GSTIN when one is provided', () => {
    expect(() => customerRegistrationSchema.parse({ ...valid, gstNumber: 'not-a-gstin' })).toThrow();
  });

  it('accepts a valid GSTIN', () => {
    const result = customerRegistrationSchema.parse({ ...valid, gstNumber: '29ABCDE1234F1Z5' });
    expect(result.gstNumber).toBe('29ABCDE1234F1Z5');
  });
});

describe('orderBookingSchema', () => {
  it('requires at least one item', () => {
    expect(() => orderBookingSchema.parse({ items: [] })).toThrow();
  });

  it('accepts a valid single-item order', () => {
    const result = orderBookingSchema.parse({ items: [{ productId: 'clx0000000000000000000000', quantity: 5 }] });
    expect(result.items).toHaveLength(1);
  });

  it('rejects a non-positive quantity', () => {
    expect(() =>
      orderBookingSchema.parse({ items: [{ productId: 'clx0000000000000000000000', quantity: 0 }] }),
    ).toThrow();
  });
});

describe('expenseEntrySchema', () => {
  const valid = {
    categoryId: 'clx0000000000000000000000',
    amount: 350,
    expenseDate: new Date('2026-08-29').toISOString(),
  };

  it('accepts a minimal valid expense and defaults payment mode to CASH', () => {
    const result = expenseEntrySchema.parse(valid);
    expect(result.paymentMode).toBe('CASH');
  });

  it('rejects a non-positive amount', () => {
    expect(() => expenseEntrySchema.parse({ ...valid, amount: 0 })).toThrow();
  });

  it('rejects an empty category id', () => {
    expect(() => expenseEntrySchema.parse({ ...valid, categoryId: '' })).toThrow();
  });

  it('accepts a non-cuid category id (the seeded defaults use fixed ids like "excat_fuel")', () => {
    const result = expenseEntrySchema.parse({ ...valid, categoryId: 'excat_fuel' });
    expect(result.categoryId).toBe('excat_fuel');
  });

  it('accepts an optional GPS location', () => {
    const result = expenseEntrySchema.parse({ ...valid, location: { latitude: 14.62, longitude: 74.83, accuracy: 15 } });
    expect(result.location?.latitude).toBe(14.62);
  });
});

describe('expenseLocationSchema', () => {
  it('rejects an out-of-range latitude', () => {
    expect(() => expenseLocationSchema.parse({ latitude: 200, longitude: 74.83 })).toThrow();
  });
});

describe('expenseCategoryCreateSchema', () => {
  it('accepts a valid category', () => {
    const result = expenseCategoryCreateSchema.parse({ name: 'Field Camp', code: 'field_camp' });
    expect(result.code).toBe('FIELD_CAMP'); // uppercased
  });

  it('rejects a code with invalid characters', () => {
    expect(() => expenseCategoryCreateSchema.parse({ name: 'Field Camp', code: 'field camp!' })).toThrow();
  });
});
