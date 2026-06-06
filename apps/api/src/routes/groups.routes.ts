import {
  addKeyword,
  createMonitoredGroup,
  deleteKeyword,
  deleteMonitoredGroup,
  listMonitoredGroups,
  notify,
  setMonitoredGroupEnabled,
  type KeywordRow,
  type MonitoredGroupRow,
} from '@nossoradar/db';
import {
  addKeywordInput,
  createMonitoredGroupInput,
  NOTIFY_CHANNELS,
  updateMonitoredGroupInput,
} from '@nossoradar/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const idParam = z.object({ id: z.string().uuid() });

function serializeKeyword(k: KeywordRow): Record<string, unknown> {
  return {
    id: k.id,
    monitoredGroupId: k.monitoredGroupId,
    term: k.term,
    createdAt: k.createdAt.toISOString(),
  };
}

function serializeGroup(g: MonitoredGroupRow): Record<string, unknown> {
  return {
    id: g.id,
    jid: g.jid,
    name: g.name,
    enabled: g.enabled,
    createdAt: g.createdAt.toISOString(),
    keywords: g.keywords.map(serializeKeyword),
  };
}

export const groupsRoutes: FastifyPluginAsync = async (fastify) => {
  // Todas as rotas exigem auth.
  fastify.addHook('preHandler', fastify.requireAuth);

  /** GET /api/groups → Grupos Monitorados com suas Palavras-chave. */
  fastify.get('/groups', async () => {
    const groups = await listMonitoredGroups();
    return groups.map(serializeGroup);
  });

  /** POST /api/groups → cria Grupo Monitorado (+ keywords) e NOTIFY config_changed. */
  fastify.post('/groups', async (request, reply) => {
    const body = createMonitoredGroupInput.parse(request.body);
    const group = await createMonitoredGroup({
      jid: body.jid,
      name: body.name,
      keywords: body.keywords,
    });
    await notify(NOTIFY_CHANNELS.configChanged);
    return reply.code(201).send(serializeGroup(group));
  });

  /** PATCH /api/groups/:id → liga/desliga (enabled) e NOTIFY config_changed. */
  fastify.patch('/groups/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const { enabled } = updateMonitoredGroupInput.parse(request.body);
    const group = await setMonitoredGroupEnabled(id, enabled);
    if (!group) return reply.code(404).send({ message: 'Grupo monitorado não encontrado.' });
    await notify(NOTIFY_CHANNELS.configChanged);
    return serializeGroup(group);
  });

  /** DELETE /api/groups/:id → remove (keywords em cascata) e NOTIFY config_changed. */
  fastify.delete('/groups/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const removed = await deleteMonitoredGroup(id);
    if (!removed) return reply.code(404).send({ message: 'Grupo monitorado não encontrado.' });
    await notify(NOTIFY_CHANNELS.configChanged);
    return reply.code(204).send();
  });

  /** POST /api/groups/:id/keywords → adiciona Palavra-chave e NOTIFY config_changed. */
  fastify.post('/groups/:id/keywords', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const { term } = addKeywordInput.parse(request.body);
    const keyword = await addKeyword(id, term);
    if (!keyword) return reply.code(404).send({ message: 'Grupo monitorado não encontrado.' });
    await notify(NOTIFY_CHANNELS.configChanged);
    return reply.code(201).send(serializeKeyword(keyword));
  });

  /** DELETE /api/keywords/:id → remove Palavra-chave e NOTIFY config_changed. */
  fastify.delete('/keywords/:id', async (request, reply) => {
    const { id } = idParam.parse(request.params);
    const removed = await deleteKeyword(id);
    if (!removed) return reply.code(404).send({ message: 'Palavra-chave não encontrada.' });
    await notify(NOTIFY_CHANNELS.configChanged);
    return reply.code(204).send();
  });
};
