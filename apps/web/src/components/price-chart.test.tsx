import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PricePoint } from '@nossoradar/shared';

import { PriceChart } from './price-chart';

const point = (id: string, iso: string, price: number): PricePoint => ({
  detectionId: `00000000-0000-0000-0000-00000000000${id}`,
  detectedAt: iso,
  price,
  groupName: 'IURI',
  title: 'Ryzen 7 5800X3D',
});

describe('PriceChart', () => {
  const points = [
    point('1', '2026-10-01T12:00:00Z', 1800),
    point('2', '2026-10-15T12:00:00Z', 1671),
    point('3', '2026-11-10T19:11:50Z', 1701),
  ];

  it('desenha um ponto por oferta e destaca o menor preço', () => {
    render(<PriceChart points={points} median={1718} />);
    expect(screen.getAllByTestId('point')).toHaveLength(2);
    const min = screen.getByTestId('min-point');
    expect(min.textContent).toContain('R$ 1.671');
  });

  it('tem linha de mediana e descrição acessível', () => {
    render(<PriceChart points={points} median={1718} />);
    expect(screen.getByTestId('median-line')).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('mediana R$ 1.718');
  });

  it('um único ponto não quebra (sem divisão por zero)', () => {
    render(<PriceChart points={[point('1', '2026-10-01T12:00:00Z', 100)]} median={100} />);
    const circle = screen.getByTestId('min-point');
    expect(Number(circle.getAttribute('cx'))).not.toBeNaN();
    expect(Number(circle.getAttribute('cy'))).not.toBeNaN();
  });
});
