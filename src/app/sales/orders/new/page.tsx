'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Plus, Minus, Trash2 } from 'lucide-react';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface Customer {
  id: string;
  firmName: string;
  mobile: string;
}
interface ProductResult {
  id: string;
  name: string;
  packSize: string | null;
  price: { ptr: number | null; mrp: number };
  minOrderQty: number;
  company: { name: string } | null;
}
interface Line {
  productId: string;
  name: string;
  packSize: string | null;
  unitPrice: number;
  quantity: number;
}

export default function NewSalesOrderPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-faint">Loading…</p>}>
      <NewSalesOrderInner />
    </Suspense>
  );
}

function NewSalesOrderInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState(params.get('customerId') ?? '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductResult[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch('/api/customers')
      .then((r) => r.json())
      .then((json) => json.ok && setCustomers(json.data));
  }, []);

  const repeatOrderId = params.get('repeatOrderId');
  useEffect(() => {
    if (!repeatOrderId) return;
    fetch(`/api/orders/${repeatOrderId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) return;
        setLines(
          json.data.items.map((item: { productId: string; product: { name: string; packSize: string | null }; unitPrice: string; quantity: number }) => ({
            productId: item.productId,
            name: item.product.name,
            packSize: item.product.packSize,
            unitPrice: Number(item.unitPrice),
            quantity: item.quantity,
          })),
        );
      });
  }, [repeatOrderId]);

  const search = useCallback(async () => {
    if (!query.trim()) return setResults([]);
    const res = await fetch(`/api/products?query=${encodeURIComponent(query)}&pageSize=10`);
    const json = await res.json();
    if (json.ok) setResults(json.data.items);
  }, [query]);

  useEffect(() => {
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [search]);

  function addProduct(p: ProductResult) {
    setLines((prev) => {
      if (prev.some((l) => l.productId === p.id)) return prev;
      return [...prev, { productId: p.id, name: p.name, packSize: p.packSize, unitPrice: p.price.ptr ?? p.price.mrp, quantity: p.minOrderQty }];
    });
    setQuery('');
    setResults([]);
  }

  function setQty(productId: string, qty: number) {
    setLines((prev) => (qty <= 0 ? prev.filter((l) => l.productId !== productId) : prev.map((l) => (l.productId === productId ? { ...l, quantity: qty } : l))));
  }

  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  async function confirm() {
    setError(null);
    if (!customerId) return setError('Please select a customer.');
    if (lines.length === 0) return setError('Add at least one product.');
    setPending(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      router.push(`/sales/orders?justBooked=${json.data.orderNumber}`);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-lg font-semibold text-ink">Book Order</h1>
      {error && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <Select id="customer" label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
        <option value="">Select a customer…</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.firmName} ({c.mobile})
          </option>
        ))}
      </Select>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" size={18} />
        <Input id="product-search" placeholder="Search products to add…" className="pl-10" value={query} onChange={(e) => setQuery(e.target.value)} />
        {results.length > 0 && (
          <Card className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto p-1">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm hover:bg-surface-subtle"
              >
                <span>
                  {p.name} <span className="text-ink-faint">· {p.company?.name}</span>
                </span>
                <span className="text-ink-muted">₹{(p.price.ptr ?? p.price.mrp).toFixed(2)}</span>
              </button>
            ))}
          </Card>
        )}
      </div>

      <div className="space-y-2">
        {lines.map((l) => (
          <Card key={l.productId} className="flex items-center gap-3 p-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-ink">{l.name}</p>
              <p className="text-xs text-ink-faint">{l.packSize} · ₹{l.unitPrice.toFixed(2)} each</p>
            </div>
            <div className="flex items-center rounded-md border border-ink-faint/30">
              <button className="flex h-9 w-9 items-center justify-center" onClick={() => setQty(l.productId, l.quantity - 1)}>
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-sm">{l.quantity}</span>
              <button className="flex h-9 w-9 items-center justify-center" onClick={() => setQty(l.productId, l.quantity + 1)}>
                <Plus size={14} />
              </button>
            </div>
            <p className="w-20 text-right text-sm font-semibold">₹{(l.unitPrice * l.quantity).toFixed(2)}</p>
            <button onClick={() => setQty(l.productId, 0)} className="text-ink-faint hover:text-danger">
              <Trash2 size={16} />
            </button>
          </Card>
        ))}
      </div>

      <Input id="notes" label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-ink-faint/15 bg-surface p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div>
            <p className="text-xs text-ink-faint">Subtotal (excl. tax)</p>
            <p className="text-lg font-semibold text-ink">₹{total.toFixed(2)}</p>
          </div>
          <Button size="lg" disabled={pending} onClick={confirm}>
            {pending ? 'Booking…' : 'Confirm Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}
