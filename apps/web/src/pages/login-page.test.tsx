import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/contexts/auth-context';

import { LoginPage } from './login-page';

// Mocks dos serviços que tocam rede/localStorage.
const loginMock = vi.fn();
const meMock = vi.fn();
const setStoredTokenMock = vi.fn();

vi.mock('@/services/radar.service', () => ({
  radarService: {
    login: (email: string, password: string) => loginMock(email, password),
    me: () => meMock(),
  },
}));

vi.mock('@/services/token-storage', () => ({
  getStoredToken: () => null,
  setStoredToken: (t: string) => setStoredTokenMock(t),
  clearStoredToken: vi.fn(),
}));

function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/conexao" element={<div>tela de conexao</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset();
    meMock.mockReset();
    setStoredTokenMock.mockReset();
  });

  it('credenciais válidas: persiste token e navega para /conexao', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({
      token: 'jwt-xyz',
      user: { id: '1', email: 'dono@example.com', name: 'dono', avatarUrl: null },
    });

    renderLogin();

    await user.type(screen.getByLabelText('E-mail'), 'dono@example.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-correta');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByText('tela de conexao')).toBeInTheDocument();
    });
    expect(loginMock).toHaveBeenCalledWith('dono@example.com', 'senha-correta');
    expect(setStoredTokenMock).toHaveBeenCalledWith('jwt-xyz');
  });

  it('credenciais inválidas (401): mostra erro e não navega', async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(new Error('401'));

    renderLogin();

    await user.type(screen.getByLabelText('E-mail'), 'dono@example.com');
    await user.type(screen.getByLabelText('Senha'), 'errada');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Credenciais inválidas.');
    });
    expect(screen.queryByText('tela de conexao')).not.toBeInTheDocument();
  });
});
