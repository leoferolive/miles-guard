import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/contexts/use-auth';

/**
 * Destino do redirect do OAuth: `${PUBLIC_URL}/auth/callback?token=<jwt>`.
 * Lê o token, persiste, carrega /api/me e segue para o Painel. Sem token → login.
 */
export const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setError('Token ausente no retorno do login.');
      const timer = setTimeout(() => navigate('/login', { replace: true }), 1500);
      return () => clearTimeout(timer);
    }

    void login(token).then(() => {
      navigate('/conexao', { replace: true });
    });
  }, [searchParams, login, navigate]);

  return (
    <div className="center-screen">
      {error ? (
        <p className="error-banner">{error}</p>
      ) : (
        <>
          <div className="spinner" aria-hidden="true" />
          <p>Concluindo o login…</p>
        </>
      )}
    </div>
  );
};
