import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { ProductHistory } from '@nossoradar/shared';

import { ProdutoPage } from './produto-page';

const getProductHistoryMock = vi.fn();

vi.mock('@/services/radar.service', () => ({
  radarService: { getProductHistory: (k: string) => getProductHistoryMock(k) },
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ title, children }: { title: string; children: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

const history: ProductHistory = {
  productKey: 'c:5800x3d',
  title: 'Processador AMD Ryzen 7 5800X3D',
  points: [
    { detectionId: '00000000-0000-0000-0000-000000000001', detectedAt: '2026-10-01T12:00:00.000Z', price: 1800, groupName: 'RB', title: 'x' },
    { detectionId: '00000000-0000-0000-0000-000000000002', detectedAt: '2026-11-10T19:11:50.000Z', price: 1701, groupName: 'IURI', title: 'y' },
  ],
  stats: { offers: 2, median: 1750.5, min: 1701, max: 1800 },
};

describe('ProdutoPage', () => {
  it('decodifica a chave da URL e mostra resumo, gráfico e ofertas', async () => {
    getProductHistoryMock.mockResolvedValue(history);
    render(
      <MemoryRouter initialEntries={['/precos/c%3A5800x3d']}>
        <Routes>
          <Route path="/precos/:productKey" element={<ProdutoPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Processador AMD Ryzen 7 5800X3D' })).toBeTruthy();
    expect(getProductHistoryMock).toHaveBeenCalledWith('c:5800x3d');
    expect(screen.getByText('Mediana')).toBeTruthy();
    expect(screen.getByText('Ofertas (2)')).toBeTruthy();
    expect(screen.getByRole('img')).toBeTruthy(); // gráfico
  });

  it('produto sem histórico mostra o erro', async () => {
    getProductHistoryMock.mockRejectedValue(new Error('404'));
    render(
      <MemoryRouter initialEntries={['/precos/c%3Anada']}>
        <Routes>
          <Route path="/precos/:productKey" element={<ProdutoPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/sem histórico de preço/)).toBeTruthy();
  });
});
