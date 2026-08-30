import Link from 'next/link';
import { Download } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { TableContainer, Table, Thead, Tr, Th, Td } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function AccountPage() {
  const session = await getCurrentUser();
  const customer = await prisma.customer.findUnique({ where: { userId: session!.userId } });
  if (!customer) return null;

  const entries = await prisma.ledgerEntry.findMany({ where: { customerId: customer.id }, orderBy: { entryDate: 'desc' } });
  const outstanding = entries.length > 0 ? Number(entries[0]!.balanceAfter) : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-ink">My Account</h1>

      <Card className="p-4">
        <p className="text-sm font-semibold text-ink">{customer.firmName}</p>
        <p className="text-sm text-ink-muted">{customer.ownerName}</p>
        <p className="text-sm text-ink-muted">{customer.address}, {customer.city} - {customer.pincode}</p>
        <p className="text-sm text-ink-muted">Mobile: {customer.mobile}</p>
        {customer.gstNumber && <p className="text-sm text-ink-muted">GSTIN: {customer.gstNumber}</p>}
      </Card>

      <Card className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs font-medium uppercase text-ink-faint">Outstanding Balance</p>
          <p className="text-2xl font-semibold text-ink">₹{outstanding.toFixed(2)}</p>
        </div>
        <Link
          href={`/api/customers/${customer.id}/ledger/export`}
          className="flex items-center gap-1.5 rounded-md border border-ink-faint/30 px-3 py-2 text-sm font-medium text-ink hover:bg-surface-subtle"
        >
          <Download size={16} />
          Download Statement
        </Link>
      </Card>

      <h2 className="text-sm font-semibold text-ink">Account Statement</h2>
      {entries.length === 0 ? (
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
              {entries.map((e) => (
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
