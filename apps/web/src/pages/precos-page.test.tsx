import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductSummary } from '@nossoradar/shared';

import { PrecosPage } from './precos-page';

const listProductsMock = vi.fn();
const listCategoriesMock = vi.fn();

vi.mock('@/services/radar.service', () => ({
  radarService: {
    listProducts: (f?: unknown) => listProductsMock(f),
    listCategories: () => listCategoriesMock(),
  },
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const product: ProductSummary = {
  productKey: 'c:5800x3d',
  title: 'Processador AMD Ryzen 7 5800X3D',
  category: 'Processador',
  lastPrice: 1671,
  lastSeenAt: '2026-11-10T19:11:50.000Z',
  offers: 6,
  minPrice: 1671,
  medianPrice: 1718,
};

describe('PrecosPage', () => {
  beforeEach(() => {
    listProductsMock.mockReset();
    listCategoriesMock.mockReset();
    listCategoriesMock.mockResolvedValue(['Processador', 'Monitor', 'Kit', 'Outros']);
  });

  it('lista produtos com link para o histórico, diferença e selo de menor preço', async () => {
    listProductsMock.mockResolvedValue([product]);
    render(<PrecosPage />, { wrapper: MemoryRouter });

    const link = await screen.findByRole('link', { name: 'Processador AMD Ryzen 7 5800X3D' });
    expect(link.getAttribute('href')).toBe('/precos/c%3A5800x3d');
    expect(screen.getByText('-2,7%')).toBeTruthy();
    expect(screen.getByTitle('Menor preço já visto')).toBeTruthy();
    expect(screen.getByText('Processador', { selector: '.cat-tag' })).toBeTruthy();
  });

  it('não exibe rótulo para categoria desconhecida (Outros/null)', async () => {
    listProductsMock.mockResolvedValue([
      { ...product, productKey: 'a', title: 'Coisa A', category: 'Outros' },
      { ...product, productKey: 'b', title: 'Coisa B', category: null },
    ]);
    const { container } = render(<PrecosPage />, { wrapper: MemoryRouter });
    await screen.findByRole('link', { name: 'Coisa A' });
    expect(container.querySelector('.cat-tag')).toBeNull();
  });

  it('filtro de categoria repassa a categoria ao serviço (junto com a busca)', async () => {
    listProductsMock.mockResolvedValue([]);
    render(<PrecosPage />, { wrapper: MemoryRouter });
    await screen.findByRole('option', { name: 'Monitor' });

    await userEvent.selectOptions(screen.getByLabelText('Categoria'), 'Monitor');
    await waitFor(() =>
      expect(listProductsMock).toHaveBeenLastCalledWith({ search: undefined, category: 'Monitor' }),
    );

    await userEvent.type(screen.getByLabelText('Buscar produto'), 'lg');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() =>
      expect(listProductsMock).toHaveBeenLastCalledWith({ search: 'lg', category: 'Monitor' }),
    );
  });

  it('busca repassa o termo ao serviço', async () => {
    listProductsMock.mockResolvedValue([]);
    render(<PrecosPage />, { wrapper: MemoryRouter });
    await screen.findByText('Nenhum produto com histórico de preço ainda.');

    await userEvent.type(screen.getByLabelText('Buscar produto'), 'oneblade');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() =>
      expect(listProductsMock).toHaveBeenLastCalledWith({
        search: 'oneblade',
        category: undefined,
      }),
    );
  });
});
