'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Textarea } from '@/components/ui/Input';

export default function CartPage() {
  const { items, updateQuantity, removeItem, clear, total } = useCart();
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function confirmOrder() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      clear();
      router.push(`/customer/orders/${json.data.orderId}?justBooked=1`);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty."
        description="Search for products and add them to your cart to book an order."
        action={
          <Link href="/customer/products" className="text-sm font-medium text-brand-600 underline">
            Browse products
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-lg font-semibold text-ink">Review Cart</h1>
      {error && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.productId} className="flex items-center gap-3 p-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">{item.name}</p>
              <p className="text-xs text-ink-faint">
                {item.packSize} · ₹{item.unitPrice.toFixed(2)} each
              </p>
            </div>
            <div className="flex items-center rounded-md border border-ink-faint/30">
              <button className="flex h-9 w-9 items-center justify-center" onClick={() => updateQuantity(item.productId, item.quantity - 1)} aria-label="Decrease">
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-sm">{item.quantity}</span>
              <button className="flex h-9 w-9 items-center justify-center" onClick={() => updateQuantity(item.productId, item.quantity + 1)} aria-label="Increase">
                <Plus size={14} />
              </button>
            </div>
            <p className="w-20 text-right text-sm font-semibold text-ink">₹{(item.unitPrice * item.quantity).toFixed(2)}</p>
            <button onClick={() => removeItem(item.productId)} aria-label="Remove item" className="text-ink-faint hover:text-danger">
              <Trash2 size={16} />
            </button>
          </Card>
        ))}
      </div>

      <Textarea id="notes" label="Order notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-ink-faint/15 bg-surface p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-xs text-ink-faint">Subtotal (excl. tax)</p>
            <p className="text-lg font-semibold text-ink">₹{total.toFixed(2)}</p>
          </div>
          <Button size="lg" disabled={pending} onClick={confirmOrder}>
            {pending ? 'Booking…' : 'Confirm Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}
