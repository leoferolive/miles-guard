/**
 * Canais do barramento Postgres LISTEN/NOTIFY (ADR-0003).
 * worker e web NÃO se falam diretamente — usam estes canais.
 */
export const NOTIFY_CHANNELS = {
  /** web → worker: a config de grupos/keywords mudou; recarregue o filtro. */
  configChanged: 'config_changed',
  /** web → worker: busque a lista ao vivo de grupos do WhatsApp e faça upsert. */
  refreshGroups: 'refresh_groups',
  /** web → worker: tentativas de QR esgotadas; reset e inicie um novo ciclo (novo QR). */
  reconnectRequested: 'reconnect_requested',
  /** worker → web: uma nova Detecção foi gravada. */
  detectionCreated: 'detection_created',
  /** worker → web: status da conexão / QR mudou. */
  connectionState: 'connection_state',
  /** worker → web: a lista de grupos (whatsapp_groups) foi atualizada. */
  groupsRefreshed: 'groups_refreshed',
} as const;

export type NotifyChannel = (typeof NOTIFY_CHANNELS)[keyof typeof NOTIFY_CHANNELS];
