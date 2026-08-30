import { describe, it, expect } from 'vitest';
import { mobileSchema, otpCodeSchema, customerRegistrationSchema, orderBookingSchema } from '@/lib/validation';

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
