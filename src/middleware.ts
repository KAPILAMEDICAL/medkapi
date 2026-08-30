import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Edge-layer route guard. This is a fast, DB-free first line of defense
 * (Edge middleware cannot use Prisma) — it only checks that a
 * well-formed, correctly-signed session JWT with the right role exists.
 * The authoritative check, including session-revocation ("logout from
 * all devices") and per-action permissions, is re-verified server-side
 * on every page/API route via requireRole() in src/lib/auth/rbac.ts.
 * Never rely on this file alone for authorization decisions.
 */

const SESSION_COOKIE = 'kapila_session';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'ACCOUNTS']);
const SALES_ROLES = new Set(['SALES_BOY', 'SALES_MANAGER']);

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? '');
}

async function getRole(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return (payload as Record<string, unknown>).role as string;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = await getRole(req);

  if (pathname.startsWith('/customer')) {
    if (role !== 'CUSTOMER') return redirectTo(req, '/login/customer');
  } else if (pathname.startsWith('/sales')) {
    if (!role || !SALES_ROLES.has(role)) return redirectTo(req, '/login/sales');
  } else if (pathname.startsWith('/admin')) {
    if (!role || !ADMIN_ROLES.has(role)) return redirectTo(req, '/login/admin');
  }

  return NextResponse.next();
}

function redirectTo(req: NextRequest, path: string) {
  const url = req.nextUrl.clone();
  url.pathname = path;
  url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/customer/:path*', '/sales/:path*', '/admin/:path*'],
};
