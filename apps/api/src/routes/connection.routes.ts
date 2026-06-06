import { getConnectionState } from '@nossoradar/db';
import { connectionStatusSchema } from '@nossoradar/shared';
import type { FastifyPluginAsync } from 'fastify';

export const connectionRoutes: FastifyPluginAsync = async (fastify) => {
  /** GET /api/connection (protegido) → estado da Sessão WhatsApp (status, qr, lastConnectedAt). */
  fastify.get('/connection', { preHandler: [fastify.requireAuth] }, async () => {
    const row = await getConnectionState();
    if (!row) {
      return { status: 'disconnected', qr: null, lastConnectedAt: null, updatedAt: null };
    }
    return {
      status: connectionStatusSchema.catch('disconnected').parse(row.status),
      qr: row.qr,
      lastConnectedAt: row.lastConnectedAt ? row.lastConnectedAt.toISOString() : null,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
};
