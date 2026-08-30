import Link from 'next/link';
import Image from 'next/image';
import { Package } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export interface ProductCardData {
  id: string;
  name: string;
  composition: string | null;
  packSize: string | null;
  imageUrl: string | null;
  isFastMoving: boolean;
  isFeatured: boolean;
  company: { name: string } | null;
  price: { mrp: number; ptr: number | null };
}

export function ProductCard({ product, basePath }: { product: ProductCardData; basePath: string }) {
  return (
    <Link href={`${basePath}/${product.id}`}>
      <Card className="flex h-full flex-col p-3 transition-colors hover:border-brand-300">
        <div className="mb-2 flex h-24 items-center justify-center rounded-sm bg-surface-subtle">
          {product.imageUrl ? (
            <Image src={product.imageUrl} alt={product.name} width={80} height={80} className="h-full w-full object-contain" />
          ) : (
            <Package className="text-ink-faint" size={28} />
          )}
        </div>
        <div className="flex gap-1">
          {product.isFastMoving && <Badge tone="brand">Fast Moving</Badge>}
          {product.isFeatured && <Badge tone="info">Featured</Badge>}
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm font-medium text-ink">{product.name}</p>
        <p className="text-xs text-ink-faint">{product.company?.name}</p>
        {product.packSize && <p className="text-xs text-ink-muted">{product.packSize}</p>}
        <div className="mt-auto pt-2">
          <p className="text-sm font-semibold text-ink">MRP ₹{product.price.mrp.toFixed(2)}</p>
          {product.price.ptr !== null && <p className="text-xs text-ink-muted">Trade ₹{product.price.ptr.toFixed(2)}</p>}
        </div>
      </Card>
    </Link>
  );
}
