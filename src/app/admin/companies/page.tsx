import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableContainer, Table, Thead, Tr, Th, Td } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export default async function AdminCompaniesPage() {
  const companies = await prisma.company.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Companies"
        description={`${companies.length} compan${companies.length === 1 ? 'y' : 'ies'}`}
        actions={
          <Link href="/admin/companies/new">
            <Button size="sm">
              <Plus size={16} /> Add Company
            </Button>
          </Link>
        }
      />
      <TableContainer>
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Products</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <tbody>
            {companies.map((c) => (
              <Tr key={c.id}>
                <Td>{c.name}</Td>
                <Td>{c._count.products}</Td>
                <Td>
                  <Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableContainer>
    </div>
  );
}
