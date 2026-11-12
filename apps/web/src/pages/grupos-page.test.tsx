import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MonitoredGroup } from '@nossoradar/shared';

import { ApiError } from '@/services/api-client';

import { GruposPage } from './grupos-page';

const listGroupsMock = vi.fn();
const listCategoriesMock = vi.fn();
const updateKeywordCategoriesMock = vi.fn();
const addKeywordMock = vi.fn();

vi.mock('@/services/radar.service', () => ({
  radarService: {
    listGroups: () => listGroupsMock(),
    listWhatsappGroups: () => Promise.resolve([]),
    listCategories: () => listCategoriesMock(),
    updateKeywordCategories: (id: string, cats: string[]) => updateKeywordCategoriesMock(id, cats),
    addKeyword: (groupId: string, term: string, cats: string[]) =>
      addKeywordMock(groupId, term, cats),
  },
}));

vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: () => undefined,
}));

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const GROUP_ID = '11111111-1111-4111-8111-111111111111';
const KW_X3D = '22222222-2222-4222-8222-222222222222';
const KW_SSD = '33333333-3333-4333-8333-333333333333';

const group: MonitoredGroup = {
  id: GROUP_ID,
  jid: '120363000000000000@g.us',
  name: 'Promoções Hardware',
  enabled: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  keywords: [
    {
      id: KW_X3D,
      monitoredGroupId: GROUP_ID,
      term: 'x3d',
      categories: ['Processador'],
      createdAt: '2026-11-01T00:00:00.000Z',
    },
    {
      id: KW_SSD,
      monitoredGroupId: GROUP_ID,
      term: 'ssd',
      categories: [],
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ],
};

describe('GruposPage — categorias da Palavra-chave', () => {
  beforeEach(() => {
    listGroupsMock.mockReset().mockResolvedValue([group]);
    listCategoriesMock.mockReset().mockResolvedValue(['Processador', 'Monitor', 'Kit', 'Outros']);
    updateKeywordCategoriesMock.mockReset();
    addKeywordMock.mockReset().mockResolvedValue({});
  });

  it('mostra em quais categorias cada Palavra-chave vale e a regra da categoria desconhecida', async () => {
    render(<GruposPage />);
    expect(await screen.findByText('só em: Processador')).toBeInTheDocument();
    expect(screen.getByText('qualquer categoria')).toBeInTheDocument();
    expect(
      await screen.findByText(/Anúncios de categoria desconhecida sempre passam/),
    ).toBeInTheDocument();
  });

  it('edita as categorias e chama o PATCH com o payload certo (na ordem de exibição)', async () => {
    updateKeywordCategoriesMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<GruposPage />);

    await user.click(await screen.findByRole('button', { name: 'Editar categorias de x3d' }));
    const editor = screen.getByRole('group', { name: /Categorias em que .x3d. vale/ });
    // "Outros" e "Kit" não são oferecidos: ambos já passam por qualquer restrição.
    expect(within(editor).queryByLabelText('Outros')).toBeNull();
    expect(within(editor).queryByLabelText('Kit')).toBeNull();

    await user.click(within(editor).getByLabelText('Monitor'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(updateKeywordCategoriesMock).toHaveBeenCalledWith(KW_X3D, ['Processador', 'Monitor']),
    );
    // Recarrega os grupos após salvar.
    await waitFor(() => expect(listGroupsMock).toHaveBeenCalledTimes(2));
  });

  it('desmarcar tudo salva [] (volta a valer para qualquer categoria)', async () => {
    updateKeywordCategoriesMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<GruposPage />);

    await user.click(await screen.findByRole('button', { name: 'Editar categorias de x3d' }));
    const editor = screen.getByRole('group', { name: /Categorias em que .x3d. vale/ });
    await user.click(within(editor).getByLabelText('Processador'));
    expect(within(editor).getByText('Nada marcado: vale para qualquer categoria.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(updateKeywordCategoriesMock).toHaveBeenCalledWith(KW_X3D, []));
  });

  it('exibe o erro do backend quando o PATCH falha', async () => {
    updateKeywordCategoriesMock.mockRejectedValue(new ApiError(400, 'Categoria desconhecida: Foo'));
    const user = userEvent.setup();
    render(<GruposPage />);

    await user.click(await screen.findByRole('button', { name: 'Editar categorias de ssd' }));
    await user.click(screen.getByLabelText('Monitor'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Categoria desconhecida: Foo');
    // O editor continua aberto para corrigir.
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('adiciona Palavra-chave já com categorias', async () => {
    const user = userEvent.setup();
    render(<GruposPage />);

    await user.type(
      await screen.findByLabelText('Nova palavra-chave para Promoções Hardware'),
      'oled',
    );
    await user.click(screen.getByRole('button', { name: 'Categorias (opcional)' }));
    await user.click(screen.getByLabelText('Monitor'));
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => expect(addKeywordMock).toHaveBeenCalledWith(GROUP_ID, 'oled', ['Monitor']));
  });
});
