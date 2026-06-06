import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '@/contexts/use-auth';

/**
 * Tela de login (ADR-0007). Formulário e-mail + senha → POST /api/auth/login.
 * Em sucesso, persiste o token e vai ao Painel; em 401, mostra erro. Já
 * autenticado → vai ao Painel.
 */
export const LoginPage = () => {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/conexao" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/conexao', { replace: true });
    } catch {
      // 401 (ou falha de rede): mensagem genérica, sem revelar qual campo falhou.
      setError('Credenciais inválidas.');
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={handleSubmit} noValidate>
        <h1>
          <span className="brand-dot" aria-hidden="true" />
          nossoRadar
        </h1>
        <p className="muted">
          Painel de monitoramento de ofertas e alertas em grupos do WhatsApp.
        </p>

        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}

        <div className="login-field">
          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            className="input"
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />
        </div>

        <div className="login-field">
          <label htmlFor="login-password">Senha</label>
          <input
            id="login-password"
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="faint" style={{ fontSize: 12 }}>
          Acesso restrito ao dono.
        </p>
      </form>
    </div>
  );
};
