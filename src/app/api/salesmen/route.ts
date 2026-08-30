import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, ForbiddenError } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';
import { mobileSchema } from '@/lib/validation';

export async function GET() {
  try {
    await requireAdmin();
    const salesmen = await prisma.salesman.findMany({
      include: {
        _count: { select: { customers: true } },
        manager: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
    return ok(salesmen);
  } catch (err) {
    return fail(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  mobile: mobileSchema,
  email: z.string().trim().email().optional(),
  employeeCode: z.string().trim().min(2).max(20),
  territory: z.string().trim().max(100).optional(),
  monthlySalesTarget: z.number().nonnegative().default(0),
  monthlyCollectionTarget: z.number().nonnegative().default(0),
  managerUserId: z.string().cuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = createSchema.parse(await req.json());

    const existing = await prisma.salesman.findUnique({ where: { mobile: body.mobile } });
    if (existing) throw new ForbiddenError('A salesman with this mobile number already exists.');

    const salesman = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { role: 'SALES_BOY', mobile: body.mobile, name: body.name, email: body.email } });
      return tx.salesman.create({
        data: {
          userId: user.id,
          name: body.name,
          mobile: body.mobile,
          email: body.email,
          employeeCode: body.employeeCode,
          territory: body.territory,
          monthlySalesTarget: body.monthlySalesTarget,
          monthlyCollectionTarget: body.monthlyCollectionTarget,
          managerUserId: body.managerUserId,
        },
      });
    });

    await writeAuditLog({ actorUserId: session.userId, action: 'SALESMAN_CREATED', entityType: 'Salesman', entityId: salesman.id });
    return ok(salesman, 201);
  } catch (err) {
    return fail(err);
  }
}
