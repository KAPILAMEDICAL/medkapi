import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableContainer, Table, Thead, Tr, Th, Td } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActionButton } from '@/components/admin/ActionButton';

export default async function AdminPaymentsPage() {
  const payments = await prisma.payment.findMany({
    include: { customer: { select: { firmName: true } }, salesman: { select: { name: true } } },
    orderBy: { paidAt: 'desc' },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Payments" description={`${payments.length} payment(s)`} />

      {payments.length === 0 ? (
        <EmptyState title="No payments recorded yet." />
      ) : (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Payment</Th>
                <Th>Customer</Th>
                <Th>Collected By</Th>
                <Th>Mode</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <tbody>
              {payments.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    {p.paymentNumber}
                    <p className="text-xs text-ink-faint">{p.paidAt.toDateString()}</p>
                  </Td>
                  <Td>{p.customer.firmName}</Td>
                  <Td>{p.salesman?.name ?? 'Admin'}</Td>
                  <Td>{p.mode}</Td>
                  <Td>₹{Number(p.amount).toFixed(2)}</Td>
                  <Td>
                    <StatusBadge status={p.status} kind="payment" />
                  </Td>
                  <Td>
                    {(p.status === 'RECEIVED' || p.status === 'PENDING') && (
                      <div className="flex gap-1.5">
                        <ActionButton url={`/api/payments/${p.id}`} body={{ status: p.mode === 'CHEQUE' ? 'CLEARED' : 'VERIFIED' }}>
                          {p.mode === 'CHEQUE' ? 'Mark Cleared' : 'Verify'}
                        </ActionButton>
                        <ActionButton url={`/api/payments/${p.id}`} body={{ status: p.mode === 'CHEQUE' ? 'BOUNCED' : 'REJECTED' }} variant="outline">
                          {p.mode === 'CHEQUE' ? 'Bounced' : 'Reject'}
                        </ActionButton>
                      </div>
                    )}
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
