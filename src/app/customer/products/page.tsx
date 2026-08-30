'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';

export default function ProductSearchPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-faint">Loading…</p>}>
      <ProductSearchInner />
    </Suspense>
  );
}

function ProductSearchInner() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('query') ?? '');
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fastMoving = searchParams.get('fastMoving') === 'true';
  const featured = searchParams.get('featured') === 'true';
  const onlyNew = searchParams.get('new') === 'true';

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (fastMoving) params.set('fastMoving', 'true');
    if (featured) params.set('featured', 'true');
    if (onlyNew) params.set('new', 'true');
    params.set('pageSize', '40');

    const res = await fetch(`/api/products?${params.toString()}`);
    const json = await res.json();
    if (json.ok) {
      setItems(json.data.items);
      setTotal(json.data.total);
    }
    setLoading(false);
  }, [query, fastMoving, featured, onlyNew]);

  useEffect(() => {
    const timeout = setTimeout(load, 300); // debounce while typing
    return () => clearTimeout(timeout);
  }, [load]);

  const heading = fastMoving ? 'Fast Moving Products' : featured ? 'Featured Products' : onlyNew ? 'New Products' : 'All Products';

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-ink">{heading}</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" size={18} />
        <Input
          id="product-search"
          placeholder="Search by name, company, composition, SKU…"
          className="pl-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {loading ? (
        <p className="text-sm text-ink-faint">Searching…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No products found."
          description={query ? `No results for "${query}". Try a different spelling or a shorter term.` : 'No products match this filter yet.'}
        />
      ) : (
        <>
          <p className="text-xs text-ink-faint">{total} product(s)</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} basePath="/customer/products" product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
