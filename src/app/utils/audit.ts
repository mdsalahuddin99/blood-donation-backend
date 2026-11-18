import prisma from './prisma';

// Audit trail for critical actions (status changes, role changes, verifications).
// Fire-and-forget: an audit failure must never break the main operation.
export const createAuditLog = async (
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  details?: Record<string, unknown>,
): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    });
  } catch {
    // intentionally silent
  }
};
