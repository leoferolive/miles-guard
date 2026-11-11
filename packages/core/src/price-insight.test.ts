import { describe, expect, it } from 'vitest';

import { priceInsight } from './index.js';

describe('priceInsight', () => {
  it('sem histórico suficiente (< 3 ofertas anteriores) → null', () => {
    expect(priceInsight(100, [])).toBeNull();
    expect(priceInsight(100, [90, 110])).toBeNull();
  });

  it('calcula mediana e diferença percentual (ímpar)', () => {
    const r = priceInsight(90, [100, 120, 80]);
    expect(r).toMatchObject({ median: 100, sampleSize: 3, deltaPct: -10 });
  });

  it('mediana com quantidade par = média dos dois do meio', () => {
    expect(priceInsight(100, [80, 90, 110, 120])?.median).toBe(100);
  });

  it('selo só com >= 5 ofertas anteriores', () => {
    expect(priceInsight(10, [100, 120, 80, 90])?.badge).toBeNull();
  });

  it('abaixo de todos os anteriores → lowest', () => {
    expect(priceInsight(70, [100, 120, 80, 90, 110])?.badge).toBe('lowest');
  });

  it('igual ao menor anterior → among_lowest (empata com o recorde)', () => {
    expect(priceInsight(80, [100, 120, 80, 90, 110])?.badge).toBe('among_lowest');
  });

  it('entre os 20% mais baratos → among_lowest', () => {
    const previous = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109];
    expect(priceInsight(101, previous)?.badge).toBe('among_lowest');
    expect(priceInsight(105, previous)?.badge).toBeNull();
  });

  it('acima da mediana → sem selo e delta positivo', () => {
    const r = priceInsight(130, [100, 120, 80, 90, 110]);
    expect(r?.badge).toBeNull();
    expect(r?.deltaPct).toBe(30);
  });
});
