import { listWhatsappGroups, notify } from '@nossoradar/db';
import { NOTIFY_CHANNELS } from '@nossoradar/shared';
import type { FastifyPluginAsync } from 'fastify';

export const whatsappRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.requireAuth);

  /** GET /api/whatsapp/groups → cache da lista ao vivo de grupos (whatsapp_groups). */
  fastify.get('/whatsapp/groups', async () => {
    const groups = await listWhatsappGroups();
    return groups.map((g) => ({
      jid: g.jid,
      name: g.name,
      participantCount: g.participantCount,
      updatedAt: g.updatedAt.toISOString(),
    }));
  });

  /** POST /api/whatsapp/refresh → pede ao worker que busque a lista ao vivo (NOTIFY refresh_groups). */
  fastify.post('/whatsapp/refresh', async (_request, reply) => {
    await notify(NOTIFY_CHANNELS.refreshGroups);
    return reply.code(202).send({ status: 'refresh_requested' });
  });
};
