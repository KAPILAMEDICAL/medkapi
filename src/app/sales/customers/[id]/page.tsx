import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Phone, MapPin, ClipboardList, IndianRupee, Repeat } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { TableContainer, Table, Thead, Tr, Th, Td } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function SalesCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCurrentUser();
  const salesman = await prisma.salesman.findUnique({ where: { userId: session!.userId } });
  if (!salesman) return null;

  const customer = await prisma.customer.findFirst({ where: { id, assignedSalesmanId: salesman.id } });
  if (!customer) notFound();

  const [ledger, lastOrder] = await Promise.all([
    prisma.ledgerEntry.findMany({ where: { customerId: id }, orderBy: { entryDate: 'desc' }, take: 15 }),
    prisma.order.findFirst({ where: { customerId: id }, orderBy: { bookedAt: 'desc' } }),
  ]);
  const outstanding = ledger.length > 0 ? Number(ledger[0]!.balanceAfter) : 0;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h1 className="text-lg font-semibold text-ink">{customer.firmName}</h1>
        <p className="text-sm text-ink-muted">{customer.ownerName}</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted">
          <MapPin size={14} /> {customer.address}, {customer.city}
        </p>
        <p className="flex items-center gap-1 text-sm text-ink-muted">
          <Phone size={14} /> {customer.mobile}
        </p>
        <p className="mt-2 text-sm">
          Outstanding: <span className={`font-semibold ${outstanding > 0 ? 'text-warning' : 'text-success'}`}>₹{outstanding.toFixed(2)}</span>
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <QuickLink href={`/sales/orders/new?customerId=${customer.id}`} icon={ClipboardList} label="Book Order" />
        <QuickLink href={`/sales/payments/new?customerId=${customer.id}`} icon={IndianRupee} label="Payment" />
        {lastOrder && (
          <QuickLink href={`/sales/orders/new?customerId=${customer.id}&repeatOrderId=${lastOrder.id}`} icon={Repeat} label="Repeat Last Order" />
        )}
      </div>

      <h2 className="text-sm font-semibold text-ink">Recent Ledger</h2>
      {ledger.length === 0 ? (
        <EmptyState title="No transactions yet." />
      ) : (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th>Debit</Th>
                <Th>Credit</Th>
                <Th>Balance</Th>
              </Tr>
            </Thead>
            <tbody>
              {ledger.map((e) => (
                <Tr key={e.id}>
                  <Td>{e.entryDate.toDateString()}</Td>
                  <Td>{e.description}</Td>
                  <Td>{Number(e.debit) > 0 ? `₹${Number(e.debit).toFixed(2)}` : '—'}</Td>
                  <Td>{Number(e.credit) > 0 ? `₹${Number(e.credit).toFixed(2)}` : '—'}</Td>
                  <Td className="font-medium">₹{Number(e.balanceAfter).toFixed(2)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof ClipboardList; label: string }) {
  return (
    <Link href={href}>
      <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-ink-faint/15 bg-surface p-3 text-center shadow-card hover:border-brand-300">
        <Icon size={18} className="text-brand-600" />
        <span className="text-xs font-medium text-ink">{label}</span>
      </div>
    </Link>
  );
}
