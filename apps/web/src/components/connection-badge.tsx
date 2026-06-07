import type { ConnectionStatus } from '@nossoradar/shared';

const LABELS: Record<ConnectionStatus, string> = {
  connected: 'Conectado',
  connecting: 'Conectando',
  qr: 'Aguardando QR',
  disconnected: 'Desconectado',
  exhausted: 'Tentativas esgotadas',
};

const CLASS: Record<ConnectionStatus, string> = {
  connected: 'badge-connected',
  connecting: 'badge-connecting',
  qr: 'badge-qr',
  disconnected: 'badge-disconnected',
  exhausted: 'badge-disconnected',
};

interface ConnectionBadgeProps {
  status: ConnectionStatus;
}

/** Selo de status da Sessão WhatsApp (conectado / conectando / qr / desconectado). */
export const ConnectionBadge = ({ status }: ConnectionBadgeProps) => (
  <span className={`badge ${CLASS[status]}`} role="status">
    <span className="badge-dot" aria-hidden="true" />
    {LABELS[status]}
  </span>
);
