import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/contexts/auth-context';

import { AuthCallbackPage } from './auth-callback-page';

// Mocks dos serviços que tocam rede/localStorage.
const meMock = vi.fn();
const setStoredTokenMock = vi.fn();

vi.mock('@/services/radar.service', () => ({
  radarService: {
    me: () => meMock(),
  },
}));

vi.mock('@/services/token-storage', () => ({
  getStoredToken: () => null,
  setStoredToken: (t: string) => setStoredTokenMock(t),
  clearStoredToken: vi.fn(),
}));

function renderAt(initialEntry: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/login" element={<div>tela de login</div>} />
          <Route path="/conexao" element={<div>tela de conexao</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    meMock.mockReset();
    setStoredTokenMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sem token: mostra erro e redireciona ao /login', async () => {
    vi.useFakeTimers();
    renderAt('/auth/callback');
    expect(screen.getByText('Token ausente no retorno do login.')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.getByText('tela de login')).toBeInTheDocument();
  });

  it('com token: persiste, carrega /api/me e vai para /conexao', async () => {
    // fluxo assíncrono (promessas) — timers reais.
    meMock.mockResolvedValue({ id: '1', email: 'dono@example.com', name: 'Dono', avatarUrl: null });

    renderAt('/auth/callback?token=jwt-xyz');

    await waitFor(() => {
      expect(screen.getByText('tela de conexao')).toBeInTheDocument();
    });
    expect(setStoredTokenMock).toHaveBeenCalledWith('jwt-xyz');
    expect(meMock).toHaveBeenCalled();
  });
});
