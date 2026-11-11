import { extractOffer, type OfferInfo } from '@nossoradar/core';

const NO_OFFER: OfferInfo = { title: null, price: null, productKey: null };

/**
 * extractOffer que nunca lança: um bug numa heurística de preço não pode derrubar a
 * gravação da detecção nem o alerta (nem travar o backfill) — vira "sem oferta".
 */
export function safeExtractOffer(text: string): OfferInfo {
  try {
    return extractOffer(text);
  } catch (err) {
    console.warn('[worker] extração de preço falhou; detecção segue sem oferta:', err);
    return NO_OFFER;
  }
}
