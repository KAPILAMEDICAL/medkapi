'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/cart';

export function AddToCartBar({
  product,
}: {
  product: { id: string; name: string; packSize: string | null; imageUrl: string | null; unitPrice: number; minOrderQty: number };
}) {
  const [qty, setQty] = useState(product.minOrderQty);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();
  const router = useRouter();

  function add() {
    addItem({
      productId: product.id,
      name: product.name,
      packSize: product.packSize,
      imageUrl: product.imageUrl,
      unitPrice: product.unitPrice,
      minOrderQty: product.minOrderQty,
      quantity: qty,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  function bookNow() {
    add();
    router.push('/customer/cart');
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t border-ink-faint/15 bg-surface p-3 md:static md:border-0 md:bg-transparent md:p-0">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <div className="flex items-center rounded-md border border-ink-faint/30">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center text-ink"
            onClick={() => setQty((q) => Math.max(product.minOrderQty, q - 1))}
            aria-label="Decrease quantity"
          >
            <Minus size={16} />
          </button>
          <span className="w-10 text-center text-sm font-medium">{qty}</span>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center text-ink"
            onClick={() => setQty((q) => q + 1)}
            aria-label="Increase quantity"
          >
            <Plus size={16} />
          </button>
        </div>
        <Button variant="outline" size="lg" className="flex-1" onClick={add}>
          <ShoppingCart size={16} />
          {added ? 'Added!' : 'Add to Cart'}
        </Button>
        <Button size="lg" className="flex-1" onClick={bookNow}>
          Book Now
        </Button>
      </div>
    </div>
  );
}
