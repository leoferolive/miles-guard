import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  NOTIFY_CHANNELS,
  type Keyword,
  type MonitoredGroup,
  type WhatsappGroup,
} from '@nossoradar/shared';

import { AppShell } from '@/components/app-shell';
import { useRealtime } from '@/hooks/use-realtime';
import { describeKeywordScope, isRestrictable } from '@/lib/category';
import { ApiError } from '@/services/api-client';
import { radarService } from '@/services/radar.service';

/** Tela Grupos Monitorados: descoberta por JID, CRUD de grupos e Palavras-chave. */
export const GruposPage = () => {
  const [groups, setGroups] = useState<MonitoredGroup[]>([]);
  const [liveGroups, setLiveGroups] = useState<WhatsappGroup[]>([]);
  const [picker, setPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Categorias de produto (GET /api/categories). Se falhar, a página segue sem a curadoria.
  const [categories, setCategories] = useState<string[]>([]);

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
    radarService
      .listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
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
            <GroupCard
              key={group.id}
              group={group}
              categories={categories}
              onChanged={loadGroups}
              onError={setError}
            />
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
  categories: string[];
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
}

const GroupCard = ({ group, categories, onChanged, onError }: GroupCardProps) => {
  const [term, setTerm] = useState('');
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [showNewCategories, setShowNewCategories] = useState(false);

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
      await radarService.addKeyword(group.id, value, newCategories);
      setTerm('');
      setNewCategories([]);
      setShowNewCategories(false);
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

      <div className="kw-section">
        <div className="kw-section-head">
          <span className="section-label">Palavras-chave</span>
          {categories.length > 0 && (
            <span className="hint">
              Restrinja cada palavra a categorias de produto. Anúncios de categoria desconhecida
              sempre passam.
            </span>
          )}
        </div>
        {group.keywords.length === 0 ? (
          <p className="faint" style={{ fontSize: 13, margin: 0 }}>
            Nenhuma Palavra-chave — o grupo não gera Detecções.
          </p>
        ) : (
          <ul className="kw-list">
            {group.keywords.map((kw) => (
              <KeywordItem
                key={kw.id}
                keyword={kw}
                categories={categories}
                onChanged={onChanged}
                onRemove={() => void removeKeyword(kw.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <form className="kw-add" onSubmit={(e) => void addKeyword(e)}>
        <div className="inline-form">
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
          {categories.length > 0 && (
            <button
              type="button"
              className="btn-link"
              aria-expanded={showNewCategories}
              onClick={() => setShowNewCategories((v) => !v)}
            >
              {newCategories.length > 0
                ? `Categorias (${newCategories.length})`
                : 'Categorias (opcional)'}
            </button>
          )}
        </div>
        {showNewCategories && (
          <CategoryPicker
            legend={`Categorias da nova palavra-chave de ${group.name}`}
            categories={categories}
            selected={newCategories}
            onChange={setNewCategories}
          />
        )}
      </form>
    </div>
  );
};

// ─── Palavra-chave (termo + categorias em que vale) ──────────────────────────

interface KeywordItemProps {
  keyword: Keyword;
  categories: string[];
  onChanged: () => Promise<void>;
  onRemove: () => void;
}

const KeywordItem = ({ keyword, categories, onChanged, onRemove }: KeywordItemProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(keyword.categories);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setDraft(keyword.categories);
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await radarService.updateKeywordCategories(keyword.id, draft);
      setEditing(false);
      await onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 400
          ? err.message
          : 'Não foi possível salvar as categorias.',
      );
    } finally {
      setSaving(false);
    }
  };

  const restricted = keyword.categories.length > 0;

  return (
    <li className="kw-item">
      <div className="kw-line">
        <span className="chip">
          {keyword.term}
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover palavra-chave ${keyword.term}`}
          >
            ×
          </button>
        </span>
        <span className={`kw-scope${restricted ? ' restricted' : ''}`}>
          {describeKeywordScope(keyword.categories)}
        </span>
        {categories.length > 0 && !editing && (
          <button
            type="button"
            className="btn-link"
            onClick={startEdit}
            aria-label={`Editar categorias de ${keyword.term}`}
          >
            Editar
          </button>
        )}
      </div>

      {editing && (
        <div className="kw-editor">
          <CategoryPicker
            legend={`Categorias em que “${keyword.term}” vale`}
            categories={categories}
            selected={draft}
            onChange={setDraft}
          />
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

// ─── Multi-seleção de categorias ─────────────────────────────────────────────

interface CategoryPickerProps {
  legend: string;
  categories: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

/**
 * Checkboxes das categorias. "Outros" fica de fora: categoria desconhecida já passa por
 * qualquer restrição, então escolhê-la não muda nada (só aparece se já estiver salva).
 * Nada marcado = qualquer categoria.
 */
const CategoryPicker = ({ legend, categories, selected, onChange }: CategoryPickerProps) => {
  // Outros/Kit sempre passam pela restrição: só aparecem se já estiverem salvos.
  const options = categories.filter((c) => isRestrictable(c) || selected.includes(c));

  const toggle = (category: string) => {
    const next = selected.includes(category)
      ? selected.filter((c) => c !== category)
      : [...selected, category];
    // Mantém a ordem de exibição das categorias (payload estável).
    onChange(categories.filter((c) => next.includes(c)));
  };

  return (
    <fieldset className="cat-picker">
      <legend className="sr-only">{legend}</legend>
      <div className="cat-options">
        {options.map((c) => (
          <label key={c} className={`cat-option${selected.includes(c) ? ' checked' : ''}`}>
            <input type="checkbox" checked={selected.includes(c)} onChange={() => toggle(c)} />
            {c}
          </label>
        ))}
      </div>
      <p className="hint">
        {selected.length === 0
          ? 'Nada marcado: vale para qualquer categoria.'
          : `Vale só em: ${selected.join(', ')}.`}
      </p>
    </fieldset>
  );
};
