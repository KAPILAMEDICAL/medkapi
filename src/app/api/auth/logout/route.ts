import { destroyCurrentSession } from '@/lib/auth/session';
import { ok, fail } from '@/lib/api-response';

export async function POST() {
  try {
    await destroyCurrentSession();
    return ok({ status: 'LOGGED_OUT' });
  } catch (err) {
    return fail(err);
  }
}
