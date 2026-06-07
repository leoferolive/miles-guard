import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectionState } from '@nossoradar/shared';

import { ConexaoPage } from './conexao-page';

// Serviço (rede) e AppShell (que puxa auth/ws/router) são mockados para isolar a página.
const getConnectionMock = vi.fn();
const requestReconnectMock = vi.fn();

vi.mock('@/services/radar.service', () => ({
  radarService: {
    getConnection: () => getConnectionMock(),
    requestReconnect: () => requestReconnectMock(),
  },
}));

// useRealtime apenas assina o barramento; no teste é um no-op.
vi.mock('@/hooks/use-realtime', () => ({
  useRealtime: () => undefined,
}));

// AppShell repassa apenas os children (evita AuthProvider/Router nos testes da página).
vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function stateWith(status: ConnectionState['status']): ConnectionState {
  return {
    status,
    qr: status === 'qr' ? '2@abc.def' : null,
    lastConnectedAt: null,
    updatedAt: '2026-06-07T00:00:00.000Z',
  };
}

describe('ConexaoPage — botão "Gerar novo QR"', () => {
  beforeEach(() => {
    getConnectionMock.mockReset();
    requestReconnectMock.mockReset();
    requestReconnectMock.mockResolvedValue(undefined);
  });

  it('renderiza o botão quando o status é exhausted e chama requestReconnect ao clicar', async () => {
    getConnectionMock.mockResolvedValue(stateWith('exhausted'));
    const user = userEvent.setup();

    render(<ConexaoPage />);

    const button = await screen.findByRole('button', { name: /gerar novo qr/i });
    expect(button).toBeInTheDocument();
    // mensagem clara de tentativas esgotadas
    expect(screen.getByText(/tentativas de qr esgotadas/i)).toBeInTheDocument();

    await user.click(button);
    await waitFor(() => expect(requestReconnectMock).toHaveBeenCalledTimes(1));
  });

  it('renderiza o botão quando o status é disconnected', async () => {
    getConnectionMock.mockResolvedValue(stateWith('disconnected'));

    render(<ConexaoPage />);

    expect(await screen.findByRole('button', { name: /gerar novo qr/i })).toBeInTheDocument();
  });

  it('NÃO renderiza o botão quando conectado', async () => {
    getConnectionMock.mockResolvedValue(stateWith('connected'));

    render(<ConexaoPage />);

    // espera a carga inicial resolver
    await waitFor(() => expect(getConnectionMock).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /gerar novo qr/i })).not.toBeInTheDocument();
  });
});
