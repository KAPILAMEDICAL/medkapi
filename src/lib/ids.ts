import { customAlphabet } from 'nanoid';

const numeric = customAlphabet('0123456789', 5);

function datePart(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Human-friendly, sortable, collision-resistant order number: ORD-20260830-48213 */
export function generateOrderNumber(): string {
  return `ORD-${datePart()}-${numeric()}`;
}

export function generatePaymentNumber(): string {
  return `PAY-${datePart()}-${numeric()}`;
}
