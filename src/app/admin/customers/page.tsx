import Link from 'next/link';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableContainer, Table, Thead, Tr, Th, Td } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActionButton } from '@/components/admin/ActionButton';
import type { CustomerStatus } from '@prisma/client';

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  DISABLED: 'neutral',
  REJECTED: 'danger',
};

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;

  const customers = await prisma.customer.findMany({
    where: status ? { status: status as CustomerStatus } : {},
    include: { assignedSalesman: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Customers" description={`${customers.length} customer(s)${status ? ` · ${status.replace(/_/g, ' ')}` : ''}`} />

      <div className="flex gap-2 text-xs">
        {['', 'PENDING_APPROVAL', 'APPROVED', 'DISABLED'].map((s) => (
          <Link
            key={s}
            href={s ? `/admin/customers?status=${s}` : '/admin/customers'}
            className={`rounded-sm px-2.5 py-1 font-medium ${status === s || (!status && !s) ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted'}`}
          >
            {s ? s.replace(/_/g, ' ') : 'All'}
          </Link>
        ))}
      </div>

      {customers.length === 0 ? (
        <EmptyState title="No customers found." />
      ) : (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Firm</Th>
                <Th>Mobile</Th>
                <Th>City</Th>
                <Th>Salesman</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <tbody>
              {customers.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <Link href={`/admin/customers/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.firmName}
                    </Link>
                    <p className="text-xs text-ink-faint">{c.ownerName}</p>
                  </Td>
                  <Td>{c.mobile}</Td>
                  <Td>{c.city}</Td>
                  <Td>{c.assignedSalesman?.name ?? '—'}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[c.status]}>{c.status.replace(/_/g, ' ')}</Badge>
                  </Td>
                  <Td>
                    {c.status === 'PENDING_APPROVAL' && (
                      <div className="flex gap-1.5">
                        <ActionButton url={`/api/customers/${c.id}`} body={{ action: 'APPROVE' }}>
                          Approve
                        </ActionButton>
                        <ActionButton url={`/api/customers/${c.id}`} body={{ action: 'REJECT' }} variant="outline">
                          Reject
                        </ActionButton>
                      </div>
                    )}
                    {c.status === 'APPROVED' && (
                      <ActionButton url={`/api/customers/${c.id}`} body={{ action: 'DISABLE' }} variant="outline" confirmMessage="Disable this customer account?">
                        Disable
                      </ActionButton>
                    )}
                    {c.status === 'DISABLED' && (
                      <ActionButton url={`/api/customers/${c.id}`} body={{ action: 'REACTIVATE' }}>
                        Reactivate
                      </ActionButton>
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
