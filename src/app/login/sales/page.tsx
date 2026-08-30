import Link from 'next/link';
import { OtpLoginForm } from '@/components/auth/OtpLoginForm';
import { Card, CardBody } from '@/components/ui/Card';

export default function SalesLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-lg font-semibold text-ink">Sales Team Login</h1>
        <p className="text-sm text-ink-muted">Kapila Medical Agencies</p>
      </div>
      <Card>
        <CardBody>
          <OtpLoginForm purpose="SALES_LOGIN" />
        </CardBody>
      </Card>
      <p className="mt-4 text-center text-xs text-ink-faint">
        Not on the sales team? Contact your manager for account setup.
      </p>
      <p className="mt-2 text-center text-xs text-ink-faint">
        <Link href="/" className="underline">
          Back
        </Link>
      </p>
    </main>
  );
}
