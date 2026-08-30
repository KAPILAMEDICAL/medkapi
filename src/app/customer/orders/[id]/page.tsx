import { notFound } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { TableContainer, Table, Thead, Tr, Th, Td } from '@/components/ui/Table';

const STATUS_STEPS = ['BOOKED', 'CONFIRMED', 'PROCESSING', 'PACKED', 'DISPATCHED', 'DELIVERED'];

export default async function CustomerOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ justBooked?: string }>;
}) {
  const { id } = await params;
  const { justBooked } = await searchParams;
  const session = await getCurrentUser();
  const customer = await prisma.customer.findUnique({ where: { userId: session!.userId } });
  if (!customer) notFound();

  const order = await prisma.order.findFirst({
    where: { id, customerId: customer.id },
    include: { items: { include: { product: true } }, salesman: { select: { name: true } } },
  });
  if (!order) notFound();

  const currentStepIndex = STATUS_STEPS.indexOf(order.status);

  return (
    <div className="space-y-4">
      {justBooked && (
        <div className="flex items-center gap-2 rounded-md bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 size={18} />
          Order booked successfully!
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">{order.orderNumber}</h1>
          <p className="text-sm text-ink-muted">{order.bookedAt.toLocaleString()}</p>
        </div>
        <StatusBadge status={order.status} kind="order" />
      </div>

      {order.status !== 'CANCELLED' && order.status !== 'RETURNED' && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, i) => (
              <div key={step} className="flex flex-1 flex-col items-center text-center">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${i <= currentStepIndex ? 'bg-brand-600' : 'bg-ink-faint/30'}`}
                />
                <p className={`mt-1 text-[10px] ${i <= currentStepIndex ? 'text-ink' : 'text-ink-faint'}`}>{step}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

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
                <Td>
                  {item.product.name}
                  <p className="text-xs text-ink-faint">{item.product.packSize}</p>
                </Td>
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

      {order.notes && (
        <Card className="p-4">
          <p className="text-xs font-medium text-ink-faint">Notes</p>
          <p className="text-sm text-ink">{order.notes}</p>
        </Card>
      )}
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
