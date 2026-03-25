import prisma from "./prisma";

interface AuditParams {
    userId: string;
    actionType: string;
    targetId: string;
    targetType: string;
    description: string;
}

export async function logAudit(params: AuditParams): Promise<void> {
    try {
        const { userId, actionType, targetId, targetType, description } = params;
        await prisma.auditLog.create({
            data: {
                userId,
                actionType,
                details: JSON.stringify({ targetId, targetType, description }),
            },
        });
    } catch {
        // Swallow errors — audit failures must never break the main request
    }
}
