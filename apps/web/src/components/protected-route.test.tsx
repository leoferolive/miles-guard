import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/contexts/auth-context';

import { ProtectedRoute } from './protected-route';

const meMock = vi.fn();
let storedToken: string | null = null;

vi.mock('@/services/radar.service', () => ({
  radarService: {
    me: () => meMock(),
  },
}));

vi.mock('@/services/token-storage', () => ({
  getStoredToken: () => storedToken,
  setStoredToken: vi.fn(),
  clearStoredToken: vi.fn(() => {
    storedToken = null;
  }),
}));

function renderGuard() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/conexao']}>
        <Routes>
          <Route
            path="/conexao"
            element={
              <ProtectedRoute>
                <div>conteudo protegido</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>tela de login</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    meMock.mockReset();
    storedToken = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sem token: redireciona ao /login', () => {
    storedToken = null;
    renderGuard();
    expect(screen.getByText('tela de login')).toBeInTheDocument();
    expect(screen.queryByText('conteudo protegido')).not.toBeInTheDocument();
  });

  it('com token válido: renderiza o conteúdo após carregar /api/me', async () => {
    storedToken = 'jwt-ok';
    meMock.mockResolvedValue({ id: '1', email: 'dono@example.com', name: null, avatarUrl: null });

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText('conteudo protegido')).toBeInTheDocument();
    });
  });

  it('token inválido (/api/me falha): redireciona ao /login', async () => {
    storedToken = 'jwt-ruim';
    meMock.mockRejectedValue(new Error('401'));

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText('tela de login')).toBeInTheDocument();
    });
  });
});
