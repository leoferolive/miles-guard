import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { useAuth } from '@/contexts/use-auth';
import { useWsStatus } from '@/hooks/use-ws-status';

interface AppShellProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

const NAV_ITEMS = [
  { to: '/conexao', label: 'Conexão', icon: '📶' },
  { to: '/grupos', label: 'Grupos Monitorados', icon: '👥' },
  { to: '/deteccoes', label: 'Detecções', icon: '🛰️' },
  { to: '/conta', label: 'Conta', icon: '⚙️' },
] as const;

const WS_LABEL = {
  connected: 'Tempo real ativo',
  connecting: 'Conectando…',
  disconnected: 'Tempo real offline',
} as const;

/** Casca do Painel: sidebar de navegação + topbar + área de conteúdo. */
export const AppShell = ({ title, actions, children }: AppShellProps) => {
  const { user, logout } = useAuth();
  const wsStatus = useWsStatus();

  const initial = (user?.name ?? user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true" />
          nossoRadar
        </div>

        <nav className="nav" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar">{initial}</span>
            <span className="user-email">{user?.email ?? '—'}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            Sair
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="row-actions">
            <span className={`badge badge-${wsStatus === 'connected' ? 'connected' : wsStatus === 'connecting' ? 'connecting' : 'disconnected'}`}>
              <span className="badge-dot" aria-hidden="true" />
              {WS_LABEL[wsStatus]}
            </span>
            {actions}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
};
