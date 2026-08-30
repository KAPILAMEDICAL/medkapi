import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { TableContainer, Table, Thead, Tr, Th, Td } from '@/components/ui/Table';
import { ActionButton } from '@/components/admin/ActionButton';

const NEXT_STATUS: Record<string, { label: string; value: string }[]> = {
  BOOKED: [{ label: 'Confirm', value: 'CONFIRMED' }, { label: 'Cancel', value: 'CANCELLED' }],
  CONFIRMED: [{ label: 'Start Processing', value: 'PROCESSING' }, { label: 'Cancel', value: 'CANCELLED' }],
  PROCESSING: [{ label: 'Mark Packed', value: 'PACKED' }, { label: 'Cancel', value: 'CANCELLED' }],
  PACKED: [{ label: 'Dispatch', value: 'DISPATCHED' }, { label: 'Cancel', value: 'CANCELLED' }],
  DISPATCHED: [{ label: 'Mark Delivered', value: 'DELIVERED' }, { label: 'Mark Returned', value: 'RETURNED' }],
};

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      salesman: { select: { name: true, mobile: true } },
      items: { include: { product: true } },
    },
  });
  if (!order) notFound();

  const actions = NEXT_STATUS[order.status] ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={order.orderNumber}
        description={`${order.customer.firmName} · ${order.bookedAt.toLocaleString()}`}
        actions={<StatusBadge status={order.status} kind="order" />}
      />

      {actions.length > 0 && (
        <div className="flex gap-2">
          {actions.map((a) => (
            <ActionButton
              key={a.value}
              url={`/api/orders/${order.id}`}
              body={{ status: a.value }}
              variant={a.value === 'CANCELLED' || a.value === 'RETURNED' ? 'outline' : 'primary'}
              confirmMessage={a.value === 'CANCELLED' ? 'Cancel this order?' : undefined}
            >
              {a.label}
            </ActionButton>
          ))}
        </div>
      )}

      <Card className="p-4 text-sm">
        <p>Salesman: {order.salesman?.name ?? 'Direct / Customer app'}</p>
        {order.notes && <p className="mt-1 text-ink-muted">Notes: {order.notes}</p>}
      </Card>

      <TableContainer>
        <Table>
          <Thead>
            <Tr>
              <Th>Product</Th>
              <Th>Qty</Th>
              <Th>Unit Price</Th>
              <Th>Line Total</Th>
            </Tr>
          </Thead>
          <tbody>
            {order.items.map((item) => (
              <Tr key={item.id}>
                <Td>{item.product.name}</Td>
                <Td>{item.quantity}</Td>
                <Td>₹{Number(item.unitPrice).toFixed(2)}</Td>
                <Td>₹{Number(item.lineTotal).toFixed(2)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableContainer>

      <Card className="ml-auto max-w-xs p-4">
        <Row label="Subtotal" value={order.subtotal} />
        <Row label="Tax (GST)" value={order.taxTotal} />
        <Row label="Grand Total" value={order.grandTotal} bold />
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: unknown; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1 text-sm ${bold ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
      <span>{label}</span>
      <span>₹{Number(value).toFixed(2)}</span>
    </div>
  );
}
