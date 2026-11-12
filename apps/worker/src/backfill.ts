import { OFFER_EXTRACTION_VERSION } from '@nossoradar/core';
import { listDetectionsPendingExtraction, updateDetectionOffer } from '@nossoradar/db';

import { safeExtractOffer } from './offer.js';

/**
 * Preenche preço/produto das detecções gravadas antes do histórico de preço existir (ou
 * extraídas com regras antigas: `extraction_version` < atual). Idempotente: ao mudar as
 * heurísticas, basta subir OFFER_EXTRACTION_VERSION que o próximo boot reprocessa tudo.
 * Retorna quantas detecções foram atualizadas.
 */
export async function backfillOfferExtraction(opts: { batchSize?: number } = {}): Promise<number> {
  const batchSize = opts.batchSize ?? 200;
  let total = 0;
  for (;;) {
    const batch = await listDetectionsPendingExtraction(OFFER_EXTRACTION_VERSION, batchSize);
    if (batch.length === 0) return total;
    for (const row of batch) {
      const offer = safeExtractOffer(row.messageText);
      // Grava a versão mesmo sem oferta: senão a linha volta em todo lote (loop infinito).
      await updateDetectionOffer(row.id, {
        price: offer.price,
        productKey: offer.productKey,
        productTitle: offer.title,
        category: offer.category,
        extractionVersion: OFFER_EXTRACTION_VERSION,
      });
      total += 1;
    }
  }
}
