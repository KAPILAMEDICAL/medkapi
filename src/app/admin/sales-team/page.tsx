import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableContainer, Table, Thead, Tr, Th, Td } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function AdminSalesTeamPage() {
  const monthStart = startOfMonth();
  const salesmen = await prisma.salesman.findMany({
    include: { _count: { select: { customers: true } } },
    orderBy: { name: 'asc' },
  });

  const performance = await Promise.all(
    salesmen.map(async (s) => {
      const [sales, collection] = await Promise.all([
        prisma.order.aggregate({ where: { salesmanId: s.id, bookedAt: { gte: monthStart } }, _sum: { grandTotal: true } }),
        prisma.payment.aggregate({ where: { salesmanId: s.id, paidAt: { gte: monthStart } }, _sum: { amount: true } }),
      ]);
      return {
        salesman: s,
        sales: Number(sales._sum.grandTotal ?? 0),
        collection: Number(collection._sum.amount ?? 0),
      };
    }),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sales Team"
        description={`${salesmen.length} member(s)`}
        actions={
          <Link href="/admin/sales-team/new">
            <Button size="sm">
              <Plus size={16} /> Add Salesman
            </Button>
          </Link>
        }
      />
      <TableContainer>
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Territory</Th>
              <Th>Customers</Th>
              <Th>Month Sales / Target</Th>
              <Th>Month Collection / Target</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <tbody>
            {performance.map(({ salesman: s, sales, collection }) => (
              <Tr key={s.id}>
                <Td>
                  {s.name}
                  <p className="text-xs text-ink-faint">{s.employeeCode} · {s.mobile}</p>
                </Td>
                <Td>{s.territory ?? '—'}</Td>
                <Td>{s._count.customers}</Td>
                <Td>
                  ₹{sales.toFixed(0)} / ₹{Number(s.monthlySalesTarget).toFixed(0)}
                </Td>
                <Td>
                  ₹{collection.toFixed(0)} / ₹{Number(s.monthlyCollectionTarget).toFixed(0)}
                </Td>
                <Td>
                  <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableContainer>
    </div>
  );
}
