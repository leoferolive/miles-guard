import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  NOTIFY_CHANNELS,
  type MonitoredGroup,
  type WhatsappGroup,
} from '@nossoradar/shared';

import { AppShell } from '@/components/app-shell';
import { useRealtime } from '@/hooks/use-realtime';
import { radarService } from '@/services/radar.service';

/** Tela Grupos Monitorados: descoberta por JID, CRUD de grupos e Palavras-chave. */
export const GruposPage = () => {
  const [groups, setGroups] = useState<MonitoredGroup[]>([]);
  const [liveGroups, setLiveGroups] = useState<WhatsappGroup[]>([]);
  const [picker, setPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    try {
      setGroups(await radarService.listGroups());
    } catch {
      setError('Falha ao carregar os Grupos Monitorados.');
    }
  }, []);

  const loadLive = useCallback(async () => {
    try {
      setLiveGroups(await radarService.listWhatsappGroups());
    } catch {
      setError('Falha ao carregar a lista de grupos do WhatsApp.');
    }
  }, []);

  useEffect(() => {
    void loadGroups();
    void loadLive();
  }, [loadGroups, loadLive]);

  // Quando o worker termina de buscar a lista ao vivo, recarrega.
  useRealtime(() => {
    void loadLive();
    setRefreshing(false);
  }, NOTIFY_CHANNELS.groupsRefreshed);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPicker(true);
    setError(null);
    try {
      await radarService.refreshWhatsappGroups();
      // Mostra o cache atual de imediato; o WS atualiza quando o worker responder.
      await loadLive();
    } catch {
      setError('Não foi possível pedir a atualização ao worker.');
      setRefreshing(false);
    }
  }, [loadLive]);

  const monitoredJids = useMemo(() => new Set(groups.map((g) => g.jid)), [groups]);

  const handleAddGroup = useCallback(
    async (group: WhatsappGroup) => {
      try {
        await radarService.createGroup({ jid: group.jid, name: group.name, keywords: [] });
        await loadGroups();
      } catch {
        setError('Não foi possível criar o Grupo Monitorado.');
      }
    },
    [loadGroups],
  );

  return (
    <AppShell
      title="Grupos Monitorados"
      actions={
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleRefresh()}>
          Buscar meus grupos
        </button>
      }
    >
      {error && <div className="error-banner">{error}</div>}

      {picker && (
        <GroupPicker
          liveGroups={liveGroups}
          monitoredJids={monitoredJids}
          refreshing={refreshing}
          onAdd={handleAddGroup}
          onClose={() => setPicker(false)}
        />
      )}

      {groups.length === 0 ? (
        <div className="empty">
          Nenhum Grupo Monitorado ainda. Clique em <strong>Buscar meus grupos</strong> para
          selecionar grupos pelo JID.
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} onChanged={loadGroups} onError={setError} />
          ))}
        </div>
      )}
    </AppShell>
  );
};

// ─── Picker de grupos ao vivo (por JID) ──────────────────────────────────────

interface GroupPickerProps {
  liveGroups: WhatsappGroup[];
  monitoredJids: Set<string>;
  refreshing: boolean;
  onAdd: (group: WhatsappGroup) => Promise<void>;
  onClose: () => void;
}

const GroupPicker = ({ liveGroups, monitoredJids, refreshing, onAdd, onClose }: GroupPickerProps) => {
  const [filter, setFilter] = useState('');

  const visible = liveGroups.filter((g) =>
    g.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="group-head">
        <div>
          <h2 className="section-title">Selecionar grupos por JID</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            {refreshing
              ? 'Pedindo a lista ao vivo ao worker…'
              : `${liveGroups.length} grupo(s) na lista do WhatsApp.`}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Fechar
        </button>
      </div>

      <input
        className="input"
        placeholder="Filtrar por nome…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Filtrar grupos"
      />

      {visible.length === 0 ? (
        <p className="faint">
          {refreshing ? 'Aguardando o worker…' : 'Nenhum grupo encontrado no cache.'}
        </p>
      ) : (
        <div className="feed">
          {visible.map((g) => {
            const already = monitoredJids.has(g.jid);
            return (
              <div key={g.jid} className="detection">
                <div className="detection-head">
                  <strong>{g.name}</strong>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={already}
                    onClick={() => void onAdd(g)}
                  >
                    {already ? 'Monitorado' : 'Monitorar'}
                  </button>
                </div>
                <div className="detection-meta">
                  <span className="group-jid">{g.jid}</span>
                  {g.participantCount != null && <span>{g.participantCount} participantes</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Cartão de Grupo Monitorado ──────────────────────────────────────────────

interface GroupCardProps {
  group: MonitoredGroup;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
}

const GroupCard = ({ group, onChanged, onError }: GroupCardProps) => {
  const [term, setTerm] = useState('');

  const toggleEnabled = async () => {
    try {
      await radarService.setGroupEnabled(group.id, !group.enabled);
      await onChanged();
    } catch {
      onError('Não foi possível alterar o status do grupo.');
    }
  };

  const removeGroup = async () => {
    try {
      await radarService.deleteGroup(group.id);
      await onChanged();
    } catch {
      onError('Não foi possível remover o grupo.');
    }
  };

  const addKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = term.trim();
    if (!value) return;
    try {
      await radarService.addKeyword(group.id, value);
      setTerm('');
      await onChanged();
    } catch {
      onError('Não foi possível adicionar a Palavra-chave.');
    }
  };

  const removeKeyword = async (keywordId: string) => {
    try {
      await radarService.deleteKeyword(keywordId);
      await onChanged();
    } catch {
      onError('Não foi possível remover a Palavra-chave.');
    }
  };

  return (
    <div className="card group-row">
      <div className="group-head">
        <div>
          <div className="group-name">{group.name}</div>
          <div className="group-jid">{group.jid}</div>
        </div>
        <div className="row-actions">
          <label className="toggle" title={group.enabled ? 'Ativo' : 'Inativo'}>
            <input
              type="checkbox"
              checked={group.enabled}
              onChange={() => void toggleEnabled()}
              aria-label={`Monitoramento ${group.enabled ? 'ativo' : 'inativo'} para ${group.name}`}
            />
            <span className="toggle-track" aria-hidden="true" />
          </label>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => void removeGroup()}>
            Remover
          </button>
        </div>
      </div>

      <div>
        <label>Palavras-chave</label>
        {group.keywords.length === 0 ? (
          <p className="faint" style={{ fontSize: 13 }}>
            Nenhuma Palavra-chave — o grupo não gera Detecções.
          </p>
        ) : (
          <div className="chips">
            {group.keywords.map((kw) => (
              <span key={kw.id} className="chip">
                {kw.term}
                <button
                  type="button"
                  onClick={() => void removeKeyword(kw.id)}
                  aria-label={`Remover palavra-chave ${kw.term}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <form className="inline-form" onSubmit={(e) => void addKeyword(e)}>
        <input
          className="input"
          placeholder="Nova palavra-chave"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label={`Nova palavra-chave para ${group.name}`}
        />
        <button type="submit" className="btn btn-ghost btn-sm" disabled={!term.trim()}>
          Adicionar
        </button>
      </form>
    </div>
  );
};
