import type {
  AuthUser,
  ConnectionState,
  Detection,
  MonitoredGroup,
  Keyword,
  Stats,
  WhatsappGroup,
  ListDetectionsQuery,
} from '@nossoradar/shared';

import { ApiClient } from './api-client';
import { clearStoredToken, getStoredToken } from './token-storage';

/**
 * Em 401, encerra a sessão: limpa o token e força recarga para a tela de login
 * (a guarda de rota redireciona quando não há token).
 */
function handleUnauthorized(): void {
  clearStoredToken();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

export const apiClient = new ApiClient({
  // baseUrl vazio: usa o proxy do Vite (dev) ou o mesmo host (prod, SPA servida pelo Painel).
  baseUrl: '',
  getToken: getStoredToken,
  onUnauthorized: handleUnauthorized,
});

export interface DetectionsPage {
  items: Detection[];
  total: number;
  limit: number;
  offset: number;
}

/** Monta a query string de listagem de Detecções (omitindo campos vazios). */
function buildDetectionsQuery(query: ListDetectionsQuery = {}): string {
  const params = new URLSearchParams();
  if (query.limit != null) params.set('limit', String(query.limit));
  if (query.offset != null) params.set('offset', String(query.offset));
  if (query.groupJid) params.set('groupJid', query.groupJid);
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.since) params.set('since', query.since);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

/** Camada de serviço: cada método mapeia um endpoint do Painel. */
export const radarService = {
  /**
   * Login do dono (ADR-0007): e-mail + senha → { token, user }.
   * `skipUnauthorizedHandler`: um 401 aqui é "credenciais inválidas" (erro a exibir
   * no formulário), não uma sessão expirada — não deve disparar o redirect global.
   */
  login: (email: string, password: string): Promise<LoginResult> =>
    apiClient.post<LoginResult>(
      '/api/auth/login',
      { email, password },
      { skipUnauthorizedHandler: true },
    ),

  me: (): Promise<AuthUser> => apiClient.get<AuthUser>('/api/me'),

  // --- Conexão ---
  getConnection: (): Promise<ConnectionState> => apiClient.get<ConnectionState>('/api/connection'),
  /** Pede ao worker um novo ciclo de QR (botão "Gerar novo QR"). */
  requestReconnect: (): Promise<void> =>
    apiClient.post<void>('/api/connection/reconnect').then(() => undefined),

  // --- Grupos Monitorados ---
  listGroups: (): Promise<MonitoredGroup[]> => apiClient.get<MonitoredGroup[]>('/api/groups'),
  createGroup: (input: { jid: string; name: string; keywords?: string[] }): Promise<MonitoredGroup> =>
    apiClient.post<MonitoredGroup>('/api/groups', input),
  setGroupEnabled: (id: string, enabled: boolean): Promise<MonitoredGroup> =>
    apiClient.patch<MonitoredGroup>(`/api/groups/${id}`, { enabled }),
  deleteGroup: (id: string): Promise<void> => apiClient.delete<void>(`/api/groups/${id}`),
  addKeyword: (groupId: string, term: string): Promise<Keyword> =>
    apiClient.post<Keyword>(`/api/groups/${groupId}/keywords`, { term }),
  deleteKeyword: (keywordId: string): Promise<void> =>
    apiClient.delete<void>(`/api/keywords/${keywordId}`),

  // --- Lista ao vivo de grupos do WhatsApp (por JID) ---
  listWhatsappGroups: (): Promise<WhatsappGroup[]> =>
    apiClient.get<WhatsappGroup[]>('/api/whatsapp/groups'),
  refreshWhatsappGroups: (): Promise<{ status: string }> =>
    apiClient.post<{ status: string }>('/api/whatsapp/refresh'),

  // --- Detecções e estatísticas ---
  listDetections: (query: ListDetectionsQuery = {}): Promise<DetectionsPage> =>
    apiClient.get<DetectionsPage>(`/api/detections${buildDetectionsQuery(query)}`),
  getStats: (): Promise<Stats> => apiClient.get<Stats>('/api/stats'),
};
