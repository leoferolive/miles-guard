import { getStats, listDetections, type DetectionRow } from '@nossoradar/db';
import { listDetectionsQuery } from '@nossoradar/shared';
import type { FastifyPluginAsync } from 'fastify';

function serializeDetection(d: DetectionRow): Record<string, unknown> {
  return {
    id: d.id,
    groupJid: d.groupJid,
    groupName: d.groupName,
    sender: d.sender,
    messageText: d.messageText,
    matchedKeywords: d.matchedKeywords,
    messageId: d.messageId,
    detectedAt: d.detectedAt.toISOString(),
    notifiedTelegram: d.notifiedTelegram,
  };
}

export const detectionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.requireAuth);

  /** GET /api/detections?limit&offset&groupJid&keyword&since → Detecções paginadas. */
  fastify.get('/detections', async (request) => {
    const q = listDetectionsQuery.parse(request.query);
    const result = await listDetections({
      limit: q.limit,
      offset: q.offset,
      groupJid: q.groupJid,
      keyword: q.keyword,
      since: q.since ? new Date(q.since) : undefined,
    });
    return {
      items: result.items.map(serializeDetection),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    };
  });

  /** GET /api/stats → totais, contagem por grupo e top Palavras-chave. */
  fastify.get('/stats', async () => {
    return getStats();
  });
};
