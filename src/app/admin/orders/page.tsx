import Link from 'next/link';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableContainer, Table, Thead, Tr, Th, Td } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import type { OrderStatus } from '@prisma/client';

const STATUSES = ['BOOKED', 'CONFIRMED', 'PROCESSING', 'PACKED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;

  const orders = await prisma.order.findMany({
    where: status ? { status: status as OrderStatus } : {},
    include: { customer: { select: { firmName: true } }, salesman: { select: { name: true } } },
    orderBy: { bookedAt: 'desc' },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Orders" description={`${orders.length} order(s)`} />

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/admin/orders" className={`rounded-sm px-2.5 py-1 font-medium ${!status ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted'}`}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/orders?status=${s}`} className={`rounded-sm px-2.5 py-1 font-medium ${status === s ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted'}`}>
            {s}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState title="No orders found." />
      ) : (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Salesman</Th>
                <Th>Date</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <tbody>
              {orders.map((o) => (
                <Tr key={o.id}>
                  <Td>
                    <Link href={`/admin/orders/${o.id}`} className="font-medium text-brand-700 hover:underline">
                      {o.orderNumber}
                    </Link>
                  </Td>
                  <Td>{o.customer.firmName}</Td>
                  <Td>{o.salesman?.name ?? '—'}</Td>
                  <Td>{o.bookedAt.toDateString()}</Td>
                  <Td>₹{Number(o.grandTotal).toFixed(2)}</Td>
                  <Td>
                    <StatusBadge status={o.status} kind="order" />
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
