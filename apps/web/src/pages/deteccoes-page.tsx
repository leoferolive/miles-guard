import { useCallback, useEffect, useState } from 'react';

import {
  NOTIFY_CHANNELS,
  type Detection,
  type MonitoredGroup,
  type Stats,
} from '@nossoradar/shared';

import { AppShell } from '@/components/app-shell';
import { useRealtime } from '@/hooks/use-realtime';
import { radarService, type DetectionsPage } from '@/services/radar.service';

const PAGE_SIZE = 20;

interface Filters {
  groupJid: string;
  keyword: string;
  since: string;
}

const EMPTY_FILTERS: Filters = { groupJid: '', keyword: '', since: '' };

/** Tela Detecções: feed ao vivo + histórico filtrável + painel de estatísticas. */
export const DeteccoesPage = () => {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState<DetectionsPage | null>(null);
  const [offset, setOffset] = useState(0);
  // Contador de refetch: muda quando há nova Detecção ou "Filtrar" — o efeito de
  // `load` é a ÚNICA fonte de fetch (evita double-fetch ao combinar setOffset + load()).
  const [reloadTick, setReloadTick] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [groups, setGroups] = useState<MonitoredGroup[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await radarService.listDetections({
        limit: PAGE_SIZE,
        offset,
        groupJid: filters.groupJid || undefined,
        keyword: filters.keyword || undefined,
        since: filters.since ? new Date(filters.since).toISOString() : undefined,
      });
      setPage(result);
      setError(null);
    } catch {
      setError('Falha ao carregar as Detecções.');
    }
    // reloadTick entra nas deps de propósito: força refetch mesmo sem mudar offset/filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, offset, reloadTick]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await radarService.getStats());
    } catch {
      /* estatísticas são secundárias; silencioso */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadStats();
    radarService
      .listGroups()
      .then(setGroups)
      .catch(() => {});
  }, [loadStats]);

  // Nova Detecção: volta à 1ª página + refetch via tick (o efeito de `load` faz o fetch);
  // atualiza estatísticas e marca a recém-chegada. NÃO chama load() aqui (evita double-fetch).
  useRealtime((msg) => {
    const incomingId = msg.payload;
    setOffset(0);
    setReloadTick((t) => t + 1);
    void loadStats();
    if (incomingId) {
      setNewIds((prev) => new Set(prev).add(incomingId));
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(incomingId);
          return next;
        });
      }, 4000);
    }
  }, NOTIFY_CHANNELS.detectionCreated);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    // Se já está no offset 0, a mudança de filtros já refaz o fetch; o tick garante
    // refetch mesmo quando os filtros não mudaram de valor.
    setReloadTick((t) => t + 1);
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setOffset(0);
  };

  const total = page?.total ?? 0;
  const items = page?.items ?? [];
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <AppShell title="Detecções">
      {error && <div className="error-banner">{error}</div>}

      {/* Estatísticas */}
      <div className="grid grid-stats">
        <div className="card">
          <div className="stat-value">{stats?.totalDetections ?? '—'}</div>
          <div className="stat-label">Detecções no total</div>
        </div>
        <div className="card">
          <div className="section-title">Top palavras-chave</div>
          <div className="chips" style={{ marginTop: 10 }}>
            {stats && stats.topKeywords.length > 0 ? (
              stats.topKeywords.slice(0, 6).map((k) => (
                <span key={k.keyword} className="chip">
                  {k.keyword} <span className="faint">·{k.count}</span>
                </span>
              ))
            ) : (
              <span className="faint">Sem dados</span>
            )}
          </div>
        </div>
        <div className="card">
          <div className="section-title">Por grupo</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats && stats.perGroup.length > 0 ? (
              stats.perGroup.slice(0, 5).map((g) => (
                <div
                  key={g.groupJid}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}
                >
                  <span className="user-email" style={{ maxWidth: 180 }}>
                    {g.groupName ?? g.groupJid}
                  </span>
                  <strong>{g.count}</strong>
                </div>
              ))
            ) : (
              <span className="faint">Sem dados</span>
            )}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <form className="card" onSubmit={applyFilters}>
        <div className="filters">
          <div>
            <label htmlFor="f-group">Grupo</label>
            <select
              id="f-group"
              className="select"
              value={filters.groupJid}
              onChange={(e) => setFilters((f) => ({ ...f, groupJid: e.target.value }))}
            >
              <option value="">Todos</option>
              {groups.map((g) => (
                <option key={g.id} value={g.jid}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-keyword">Palavra-chave</label>
            <input
              id="f-keyword"
              className="input"
              placeholder="ex.: latam"
              value={filters.keyword}
              onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="f-since">A partir de</label>
            <input
              id="f-since"
              className="input"
              type="date"
              value={filters.since}
              onChange={(e) => setFilters((f) => ({ ...f, since: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flex: '0 0 auto', minWidth: 0 }}>
            <button type="submit" className="btn btn-primary">
              Filtrar
            </button>
            <button type="button" className="btn btn-ghost" onClick={resetFilters}>
              Limpar
            </button>
          </div>
        </div>
      </form>

      {/* Feed / histórico */}
      {items.length === 0 ? (
        <div className="empty">Nenhuma Detecção encontrada para os filtros atuais.</div>
      ) : (
        <div className="feed">
          {items.map((d) => (
            <DetectionItem key={d.id} detection={d} isNew={newIds.has(d.id)} />
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="row-actions" style={{ justifyContent: 'space-between' }}>
          <span className="faint" style={{ fontSize: 13 }}>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
          </span>
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!canPrev}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Anterior
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!canNext}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
};

interface DetectionItemProps {
  detection: Detection;
  isNew: boolean;
}

const DetectionItem = ({ detection, isNew }: DetectionItemProps) => (
  <article className={`detection${isNew ? ' new' : ''}`}>
    <div className="detection-head">
      <strong>{detection.groupName ?? detection.groupJid}</strong>
      <div className="chips">
        {detection.matchedKeywords.map((kw) => (
          <span key={kw} className="kw-tag">
            {kw}
          </span>
        ))}
      </div>
    </div>
    <p className="detection-text">{detection.messageText}</p>
    <div className="detection-meta">
      {detection.sender && <span>{detection.sender}</span>}
      <span>{new Date(detection.detectedAt).toLocaleString('pt-BR')}</span>
      <span>{detection.notifiedTelegram ? '✓ Telegram' : '○ não notificado'}</span>
    </div>
  </article>
);
