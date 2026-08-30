import Link from 'next/link';
import { AdminLoginForm } from '@/components/auth/AdminLoginForm';
import { Card, CardBody } from '@/components/ui/Card';

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-lg font-semibold text-ink">Admin Portal</h1>
        <p className="text-sm text-ink-muted">Kapila Medical Agencies</p>
      </div>
      <Card>
        <CardBody>
          <AdminLoginForm />
        </CardBody>
      </Card>
      <p className="mt-4 text-center text-xs text-ink-faint">
        <Link href="/" className="underline">
          Back
        </Link>
      </p>
    </main>
  );
}
