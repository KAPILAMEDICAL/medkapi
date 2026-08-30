import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableContainer, Table, Thead, Tr, Th, Td } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { searchProducts } from '@/lib/search';

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; lowStock?: string; page?: string }>;
}) {
  const { query, lowStock, page } = await searchParams;

  const { items, total } = query
    ? await searchProducts({ query, page: page ? Number(page) : 1, pageSize: 50 })
    : {
        items: await prisma.product.findMany({
          where: lowStock === 'true' ? { isActive: true, stockQty: { lte: 10 } } : {},
          include: { company: true },
          orderBy: { name: 'asc' },
          take: 50,
        }),
        total: await prisma.product.count(),
      };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        description={`${total} product(s) total`}
        actions={
          <Link href="/admin/products/new">
            <Button size="sm">
              <Plus size={16} /> Add Product
            </Button>
          </Link>
        }
      />

      <form className="flex gap-2" action="/admin/products">
        <input
          name="query"
          defaultValue={query}
          placeholder="Search by name, company, composition, SKU…"
          className="w-full max-w-md rounded-md border border-ink-faint/40 px-3 py-2 text-sm"
        />
        <Button type="submit" variant="outline" size="md">
          Search
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="No products found." />
      ) : (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Company</Th>
                <Th>MRP</Th>
                <Th>PTR</Th>
                <Th>Stock</Th>
                <Th>Flags</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <tbody>
              {items.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    {p.name}
                    <p className="text-xs text-ink-faint">{p.sku}</p>
                  </Td>
                  <Td>{p.company.name}</Td>
                  <Td>₹{Number(p.mrp).toFixed(2)}</Td>
                  <Td>{p.ptr ? `₹${Number(p.ptr).toFixed(2)}` : '—'}</Td>
                  <Td>
                    <span className={p.stockQty <= 10 ? 'font-medium text-danger' : ''}>{p.stockQty}</span>
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      {p.isFastMoving && <Badge tone="brand">Fast</Badge>}
                      {p.isFeatured && <Badge tone="info">Featured</Badge>}
                      {!p.isActive && <Badge tone="danger">Inactive</Badge>}
                    </div>
                  </Td>
                  <Td>
                    <Link href={`/admin/products/${p.id}`} className="text-brand-600 hover:underline">
                      Edit
                    </Link>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
