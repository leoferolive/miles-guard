import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Detection } from '@nossoradar/shared';

import { DeteccoesPage } from './deteccoes-page';

const listDetectionsMock = vi.fn();

vi.mock('@/services/radar.service', () => ({
  radarService: {
    listDetections: (q: unknown) => listDetectionsMock(q),
    getStats: () => Promise.resolve({ totalDetections: 0, topKeywords: [], perGroup: [] }),
    listGroups: () => Promise.resolve([]),
    listCategories: () => Promise.resolve(['Processador', 'Monitor', 'Kit', 'Outros']),
  },
}));

vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: () => undefined,
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function detection(id: string, category: string | null, text: string): Detection {
  return {
    id,
    groupJid: '120363000000000000@g.us',
    groupName: 'Promoções Hardware',
    sender: null,
    messageText: text,
    matchedKeywords: ['x3d'],
    messageId: null,
    detectedAt: '2026-11-10T19:11:50.000Z',
    notifiedTelegram: true,
    price: null,
    productKey: null,
    category,
  };
}

describe('DeteccoesPage — categoria', () => {
  beforeEach(() => {
    listDetectionsMock.mockReset().mockResolvedValue({
      items: [
        detection('d1', 'Processador', 'Ryzen 7 5800X3D'),
        detection('d2', 'Outros', 'Coisa sem categoria'),
        detection('d3', null, 'Detecção antiga'),
      ],
      total: 3,
      limit: 20,
      offset: 0,
    });
  });

  it('mostra a categoria no card, exceto "Outros"/null', async () => {
    const { container } = render(<DeteccoesPage />, { wrapper: MemoryRouter });
    await screen.findByText('Ryzen 7 5800X3D');
    const tags = Array.from(container.querySelectorAll('.cat-tag')).map((el) => el.textContent);
    expect(tags).toEqual(['Processador']);
  });

  it('trocar a categoria estando na página 2 volta para a primeira página', async () => {
    listDetectionsMock.mockResolvedValue({
      items: [detection('d1', 'Processador', 'Ryzen 7 5800X3D')],
      total: 45,
      limit: 20,
      offset: 0,
    });
    const user = userEvent.setup();
    render(<DeteccoesPage />, { wrapper: MemoryRouter });
    await screen.findByRole('option', { name: 'Monitor' });

    await user.click(screen.getByRole('button', { name: /Próxima/ }));
    await waitFor(() =>
      expect(listDetectionsMock).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 20 })),
    );

    await user.selectOptions(screen.getByLabelText('Categoria'), 'Monitor');
    await waitFor(() =>
      expect(listDetectionsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: 'Monitor', offset: 0 }),
      ),
    );
  });

  it('resposta antiga não sobrescreve um filtro mais novo (corrida)', async () => {
    let resolveSlow: (v: unknown) => void = () => undefined;
    listDetectionsMock.mockImplementation((q: { category?: string }) =>
      q.category === 'Processador'
        ? new Promise((r) => {
            resolveSlow = r;
          })
        : Promise.resolve({
            items: [detection('m1', 'Monitor', 'Monitor rápido')],
            total: 1,
            limit: 20,
            offset: 0,
          }),
    );
    const user = userEvent.setup();
    render(<DeteccoesPage />, { wrapper: MemoryRouter });
    await screen.findByRole('option', { name: 'Monitor' });

    await user.selectOptions(screen.getByLabelText('Categoria'), 'Processador');
    await user.selectOptions(screen.getByLabelText('Categoria'), 'Monitor');
    await screen.findByText('Monitor rápido');

    resolveSlow({ items: [detection('p1', 'Processador', 'Ryzen lento')], total: 1, limit: 20, offset: 0 });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('Ryzen lento')).toBeNull();
    expect(screen.getByText('Monitor rápido')).toBeTruthy();
  });

  it('filtro de categoria repassa a categoria à listagem', async () => {
    const user = userEvent.setup();
    render(<DeteccoesPage />, { wrapper: MemoryRouter });
    await screen.findByRole('option', { name: 'Monitor' });

    await user.selectOptions(screen.getByLabelText('Categoria'), 'Monitor');
    await waitFor(() =>
      expect(listDetectionsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: 'Monitor', offset: 0 }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    await waitFor(() =>
      expect(listDetectionsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: undefined }),
      ),
    );
  });
});
