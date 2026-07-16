// @ts-nocheck
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ─── Tenant-scoping utilities ───────────────────────────────

/**
 * Creates a where clause scoped to a tenant.
 * Usage: where: tenantWhere(tenantId, { status: 'published' })
 */
export function tenantWhere(tenantId: string, extra?: Record<string, any>) {
  return { tenantId, ...extra };
}

/**
 * Creates a data object that auto-includes tenantId.
 * Usage: data: tenantData(tenantId, { content: 'Hello' })
 */
export function tenantData(tenantId: string, data: Record<string, any>) {
  return { ...data, tenantId };
}

/**
 * Verifies an entity belongs to the given tenant. Returns null if not found or unauthorized.
 */
export async function verifyTenantOwnership(
  model: string,
  entityId: string,
  tenantId: string
): Promise<any> {
  const entity = await (prisma as any)[model].findUnique({
    where: { id: entityId },
  });

  if (!entity) return null;
  if (entity.tenantId && entity.tenantId !== tenantId) return null;

  return entity;
}
