import type { Role } from '@prisma/client';
import { getCurrentUser, type CurrentUser } from '@/lib/auth/session';

export const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'ACCOUNTS'];

/** Roles allowed into the /admin portal. Fine-grained action checks (e.g.
 * "only SUPER_ADMIN can change settings") live next to the action itself. */
export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

export class ForbiddenError extends Error {}
export class UnauthorizedError extends Error {}
/** User-safe authentication failure (bad credentials, inactive account). */
export class AuthError extends Error {}
/** The requested record does not exist (or is soft-deleted / inactive). */
export class NotFoundError extends Error {}

/** Throws if there is no logged-in user, or the user's role is not in `roles`. */
export async function requireRole(roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError('Please log in to continue.');
  if (!roles.includes(user.role)) throw new ForbiddenError('You do not have permission to do that.');
  return user;
}

export async function requireCustomer() {
  return requireRole(['CUSTOMER']);
}

export async function requireSalesman() {
  return requireRole(['SALES_BOY', 'SALES_MANAGER']);
}

export async function requireAdmin() {
  return requireRole(ADMIN_ROLES);
}

export async function requireSuperAdmin() {
  return requireRole(['SUPER_ADMIN']);
}
