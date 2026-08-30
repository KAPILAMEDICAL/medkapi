'use client';

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

/**
 * Pre-checkout shopping cart, held client-side (localStorage) exactly like
 * any e-commerce cart — this is scratch state for a purchase in progress,
 * never the system of record. The moment "Confirm Order" is pressed, the
 * cart is POSTed to /api/orders (which is the real, database-backed order)
 * and then cleared; nothing about the order itself lives only in the
 * browser (Master Prompt §34's warning is about treating localStorage as
 * the database, not about a pre-submission cart).
 */

export interface CartItem {
  productId: string;
  name: string;
  packSize: string | null;
  imageUrl: string | null;
  unitPrice: number;
  minOrderQty: number;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  total: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'kapila.cart.v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore corrupted/blocked storage — cart just starts empty
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage may be unavailable (private browsing) — cart still works in-memory
    }
  }, [items, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    return {
      items,
      addItem: (item) =>
        setItems((prev) => {
          const existing = prev.find((i) => i.productId === item.productId);
          if (existing) {
            return prev.map((i) => (i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i));
          }
          return [...prev, item];
        }),
      updateQuantity: (productId, quantity) =>
        setItems((prev) =>
          quantity <= 0 ? prev.filter((i) => i.productId !== productId) : prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
        ),
      removeItem: (productId) => setItems((prev) => prev.filter((i) => i.productId !== productId)),
      clear: () => setItems([]),
      total: items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
