import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { TableContainer, Table, Thead, Tr, Th, Td } from '@/components/ui/Table';
import { AssignSalesmanForm } from '@/components/admin/AssignSalesmanForm';

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const customer = await prisma.customer.findUnique({ where: { id }, include: { assignedSalesman: true } });
  if (!customer) notFound();

  const [ledger, orders, payments, salesmen] = await Promise.all([
    prisma.ledgerEntry.findMany({ where: { customerId: id }, orderBy: { entryDate: 'desc' }, take: 20 }),
    prisma.order.findMany({ where: { customerId: id }, orderBy: { bookedAt: 'desc' }, take: 10 }),
    prisma.payment.findMany({ where: { customerId: id }, orderBy: { paidAt: 'desc' }, take: 10 }),
    prisma.salesman.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ]);
  const outstanding = ledger.length > 0 ? Number(ledger[0]!.balanceAfter) : 0;

  return (
    <div className="space-y-4">
      <PageHeader title={customer.firmName} description={customer.ownerName} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Mobile" value={customer.mobile} />
            <Field label="WhatsApp" value={customer.whatsapp ?? '—'} />
            <Field label="Email" value={customer.email ?? '—'} />
            <Field label="Customer Type" value={customer.customerType} />
            <Field label="Address" value={`${customer.address}, ${customer.city} - ${customer.pincode}`} />
            <Field label="GSTIN" value={customer.gstNumber ?? '—'} />
            <Field label="Drug Licence" value={customer.drugLicenceNo ?? '—'} />
            <Field label="Status" value={<Badge tone={customer.status === 'APPROVED' ? 'success' : 'warning'}>{customer.status}</Badge>} />
            <Field label="Price Visibility" value={customer.priceVisibility.replace(/_/g, ' ')} />
            <Field label="Outstanding" value={`₹${outstanding.toFixed(2)}`} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assign Salesman</CardTitle>
          </CardHeader>
          <CardBody>
            <AssignSalesmanForm customerId={customer.id} currentSalesmanId={customer.assignedSalesmanId} salesmen={salesmen.map((s) => ({ id: s.id, name: s.name }))} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardBody>
          {orders.length === 0 ? (
            <p className="text-sm text-ink-faint">No orders yet.</p>
          ) : (
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Order</Th>
                    <Th>Date</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {orders.map((o) => (
                    <Tr key={o.id}>
                      <Td>{o.orderNumber}</Td>
                      <Td>{o.bookedAt.toDateString()}</Td>
                      <Td>₹{Number(o.grandTotal).toFixed(2)}</Td>
                      <Td><StatusBadge status={o.status} kind="order" /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardBody>
          {payments.length === 0 ? (
            <p className="text-sm text-ink-faint">No payments yet.</p>
          ) : (
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Payment</Th>
                    <Th>Date</Th>
                    <Th>Mode</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {payments.map((p) => (
                    <Tr key={p.id}>
                      <Td>{p.paymentNumber}</Td>
                      <Td>{p.paidAt.toDateString()}</Td>
                      <Td>{p.mode}</Td>
                      <Td>₹{Number(p.amount).toFixed(2)}</Td>
                      <Td><StatusBadge status={p.status} kind="payment" /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Statement</CardTitle>
        </CardHeader>
        <CardBody>
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
        </CardBody>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="font-medium text-ink">{value}</p>
    </div>
  );
}
