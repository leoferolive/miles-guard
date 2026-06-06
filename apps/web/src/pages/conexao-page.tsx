import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useState } from 'react';

import { NOTIFY_CHANNELS, type ConnectionState } from '@nossoradar/shared';

import { AppShell } from '@/components/app-shell';
import { ConnectionBadge } from '@/components/connection-badge';
import { useRealtime } from '@/hooks/use-realtime';
import { radarService } from '@/services/radar.service';

const STATUS_HELP: Record<ConnectionState['status'], string> = {
  connected: 'O worker está pareado e monitorando os grupos.',
  connecting: 'Estabelecendo conexão com o WhatsApp…',
  qr: 'Abra o WhatsApp no celular, vá em Aparelhos conectados e escaneie o código abaixo.',
  disconnected: 'Sem sessão ativa. O worker tentará reconectar ou exibirá um novo QR.',
};

/** Tela Conexão: status da Sessão WhatsApp + QR escaneável (push via WebSocket). */
export const ConexaoPage = () => {
  const [state, setState] = useState<ConnectionState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await radarService.getConnection();
      setState(next);
      setError(null);
    } catch {
      setError('Não foi possível obter o estado da conexão.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // O worker só NOTIFY connection_state (sem payload útil) → refetch.
  useRealtime(() => void load(), NOTIFY_CHANNELS.connectionState);

  return (
    <AppShell
      title="Conexão"
      actions={
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()}>
          Atualizar
        </button>
      }
    >
      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="group-head">
          <div>
            <h2 className="section-title">Sessão WhatsApp</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              {state ? STATUS_HELP[state.status] : 'Carregando…'}
            </p>
          </div>
          {state && <ConnectionBadge status={state.status} />}
        </div>

        {state?.status === 'qr' && state.qr && (
          <div className="qr-wrap">
            <div className="qr-box">
              <QRCodeSVG value={state.qr} size={232} level="M" />
            </div>
            <p className="faint" style={{ fontSize: 13 }}>
              O código expira em segundos — se sumir, um novo aparece automaticamente.
            </p>
          </div>
        )}

        {state?.lastConnectedAt && (
          <p className="faint" style={{ fontSize: 13 }}>
            Última conexão: {new Date(state.lastConnectedAt).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
    </AppShell>
  );
};
