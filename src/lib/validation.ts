import { z } from 'zod';

/** Indian 10-digit mobile number, optionally prefixed with +91 / 91 / 0. */
export const mobileSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/^(\+?91|0)/, '').replace(/\D/g, ''))
  .refine((v) => /^[6-9]\d{9}$/.test(v), {
    message: 'Enter a valid 10-digit mobile number.',
  });

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code sent to your mobile.');

export const otpPurposeSchema = z.enum(['CUSTOMER_LOGIN', 'SALES_LOGIN', 'ADMIN_LOGIN_2FA', 'CUSTOMER_REGISTRATION']);

export const customerRegistrationSchema = z.object({
  firmName: z.string().trim().min(2, 'Firm name is required.').max(150),
  ownerName: z.string().trim().min(2, 'Owner/contact person name is required.').max(100),
  mobile: mobileSchema,
  whatsapp: mobileSchema.optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  email: z.string().trim().email().optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  address: z.string().trim().min(5, 'Address is required.').max(300),
  area: z.string().trim().max(100).optional(),
  city: z.string().trim().min(2, 'City is required.').max(100),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode.'),
  gstNumber: z
    .string()
    .trim()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid GSTIN.')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined)),
  drugLicenceNo: z.string().trim().max(50).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  customerType: z.enum(['PHARMACY', 'HOSPITAL', 'CLINIC', 'INSTITUTION', 'OTHER']).default('PHARMACY'),
});

export const cartItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().positive().max(100000),
});

export const orderBookingSchema = z.object({
  customerId: z.string().cuid().optional(), // required when a salesman books; ignored for self-service customer orders
  items: z.array(cartItemSchema).min(1, 'Add at least one product to the order.'),
  notes: z.string().trim().max(500).optional(),
});

export const paymentEntrySchema = z.object({
  customerId: z.string().cuid(),
  amount: z.number().positive().max(10_000_000),
  mode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
  referenceNumber: z.string().trim().max(60).optional(),
  chequeNumber: z.string().trim().max(30).optional(),
  chequeBank: z.string().trim().max(100).optional(),
  chequeDate: z.string().datetime().optional(),
  remarks: z.string().trim().max(300).optional(),
  receiptImageUrl: z.string().trim().optional(),
});

export const expenseEntrySchema = z.object({
  category: z.enum([
    'PETROL',
    'TRAVEL',
    'FOOD',
    'ACCOMMODATION',
    'AUTO_TAXI',
    'PARKING',
    'COURIER',
    'BUSINESS',
    'OTHER',
  ]),
  amount: z.number().positive().max(1_000_000),
  expenseDate: z.string().datetime(),
  merchant: z.string().trim().max(150).optional(),
  description: z.string().trim().max(300).optional(),
  billImageUrl: z.string().trim().optional(),
  ocrRawText: z.string().optional(),
  ocrConfidence: z.number().optional(),
  ocrProvider: z.string().optional(),
});
