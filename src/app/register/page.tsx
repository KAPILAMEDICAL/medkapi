import Link from 'next/link';
import { RegistrationForm } from '@/components/auth/RegistrationForm';
import { Card, CardBody } from '@/components/ui/Card';

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-lg font-semibold text-ink">Customer Registration</h1>
        <p className="text-sm text-ink-muted">Kapila Medical Agencies</p>
      </div>
      <Card>
        <CardBody>
          <RegistrationForm />
        </CardBody>
      </Card>
      <p className="mt-4 text-center text-sm text-ink-muted">
        Already registered?{' '}
        <Link href="/login/customer" className="font-medium text-brand-600 underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
