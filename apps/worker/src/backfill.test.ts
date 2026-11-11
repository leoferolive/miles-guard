import { describe, expect, it, vi } from 'vitest';

vi.mock('@nossoradar/db', () => ({
  listDetectionsPendingExtraction: vi.fn(),
  updateDetectionOffer: vi.fn(async () => undefined),
}));

const db = await import('@nossoradar/db');
const { OFFER_EXTRACTION_VERSION } = await import('@nossoradar/core');
const { backfillOfferExtraction } = await import('./backfill.js');

describe('backfillOfferExtraction', () => {
  it('reprocessa em lotes até acabar e grava a versão atual', async () => {
    vi.mocked(db.listDetectionsPendingExtraction)
      .mockResolvedValueOnce([
        { id: 'a', messageText: 'Processador AMD Ryzen 7 5800X3D AM4\n\n💵 R$ 1701' },
        { id: 'b', messageText: 'sem oferta nenhuma' },
      ])
      .mockResolvedValueOnce([]);

    const total = await backfillOfferExtraction({ batchSize: 2 });

    expect(total).toBe(2);
    expect(db.listDetectionsPendingExtraction).toHaveBeenCalledWith(OFFER_EXTRACTION_VERSION, 2);
    expect(db.updateDetectionOffer).toHaveBeenCalledWith('a', {
      price: 1701,
      productKey: 'c:5800x3d',
      productTitle: 'Processador AMD Ryzen 7 5800X3D AM4',
      extractionVersion: OFFER_EXTRACTION_VERSION,
    });
    // Mesmo sem oferta, marca a versão (senão o loop nunca termina).
    expect(db.updateDetectionOffer).toHaveBeenCalledWith(
      'b',
      expect.objectContaining({ price: null, extractionVersion: OFFER_EXTRACTION_VERSION }),
    );
  });
});
