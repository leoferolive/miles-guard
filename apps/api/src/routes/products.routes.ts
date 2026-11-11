import { distinctDailyPrices, median } from '@nossoradar/core';
import { getProductPricePoints, listProducts } from '@nossoradar/db';
import {
  listProductsQuery,
  productHistorySchema,
  productSummarySchema,
  type ProductHistory,
} from '@nossoradar/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const productParams = z.object({ key: z.string().min(1).max(500) });

/** Histórico de preço por produto (Painel → página Preços). */
export const productsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.requireAuth);

  /** GET /api/products?search&limit → produtos com último preço, mediana e menor preço. */
  fastify.get('/products', async (request) => {
    const q = listProductsQuery.parse(request.query);
    const rows = await listProducts({ search: q.search, category: q.category, limit: q.limit });
    return rows.map((r) =>
      productSummarySchema.parse({ ...r, lastSeenAt: r.lastSeenAt.toISOString() }),
    );
  });

  /** GET /api/products/:key/history → todos os pontos + estatísticas (sem repostagens). */
  fastify.get('/products/:key/history', async (request, reply) => {
    const { key } = productParams.parse(request.params);
    const points = await getProductPricePoints(key);
    if (points.length === 0) {
      return reply.code(404).send({ message: 'Produto sem histórico de preço.' });
    }

    const distinct = distinctDailyPrices(points.map((p) => ({ at: p.detectedAt, price: p.price })));
    const history: ProductHistory = {
      productKey: key,
      title: points.at(-1)?.title ?? null,
      points: points.map((p) => ({ ...p, detectedAt: p.detectedAt.toISOString() })),
      stats: {
        offers: distinct.length,
        median: median(distinct),
        min: Math.min(...distinct),
        max: Math.max(...distinct),
      },
    };
    return productHistorySchema.parse(history);
  });
};
