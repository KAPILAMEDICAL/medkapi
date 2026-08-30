import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { BusinessInfoForm } from '@/components/admin/BusinessInfoForm';
import { DemoDataToggle } from '@/components/admin/DemoDataToggle';

export default async function AdminSettingsPage() {
  const [businessInfo, demoFlag] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'business.info' } }),
    prisma.setting.findUnique({ where: { key: 'seed.isDemoData' } }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Business information and platform configuration." />

      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
        </CardHeader>
        <CardBody>
          <BusinessInfoForm
            initial={
              (businessInfo?.valueJson as { name: string; tagline: string; address: string; gstDefaultPercent: number }) ?? {
                name: 'Kapila Medical Agencies',
                tagline: 'Pharmaceutical Wholesale & Distribution',
                address: 'Sirsi, Uttara Kannada, Karnataka',
                gstDefaultPercent: 12,
              }
            }
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demo Data</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-3 text-sm text-ink-muted">
            When enabled, a &quot;DEMO DATA&quot; notice is shown across the customer and sales apps to make clear the
            catalog/customers are sample data, not real records. Turn this off once real Kapila Medical Agencies data
            has been imported.
          </p>
          <DemoDataToggle enabled={demoFlag?.valueJson === true} />
        </CardBody>
      </Card>
    </div>
  );
}
