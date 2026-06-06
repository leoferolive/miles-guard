import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/contexts/use-auth';
import { useWsStatus } from '@/hooks/use-ws-status';

const WS_LABEL = {
  connected: 'Conectado (recebendo eventos em tempo real)',
  connecting: 'Conectando…',
  disconnected: 'Desconectado',
} as const;

/** Tela Conta: usuário logado, status de tempo real e logout. Sem segredos. */
export const ContaPage = () => {
  const { user, logout } = useAuth();
  const wsStatus = useWsStatus();

  return (
    <AppShell title="Conta">
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h2 className="section-title">Usuário</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              width={48}
              height={48}
              style={{ borderRadius: '50%' }}
            />
          ) : (
            <span className="avatar" style={{ width: 48, height: 48, fontSize: 18 }}>
              {(user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <div style={{ fontWeight: 600 }}>{user?.name ?? 'Sem nome'}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {user?.email}
            </div>
          </div>
        </div>

        <div>
          <label>Conexão em tempo real (WebSocket)</label>
          <span
            className={`badge badge-${
              wsStatus === 'connected'
                ? 'connected'
                : wsStatus === 'connecting'
                  ? 'connecting'
                  : 'disconnected'
            }`}
          >
            <span className="badge-dot" aria-hidden="true" />
            {WS_LABEL[wsStatus]}
          </span>
        </div>

        <div>
          <label>Notificações</label>
          <p className="muted" style={{ fontSize: 13 }}>
            As Detecções são enviadas ao Telegram configurado no worker (Alerta de Detecção). As
            credenciais ficam no servidor e não são exibidas aqui.
          </p>
        </div>

        <div>
          <button type="button" className="btn btn-danger" onClick={logout}>
            Sair da conta
          </button>
        </div>
      </div>
    </AppShell>
  );
};
