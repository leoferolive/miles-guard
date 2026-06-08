import { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Registro Prometheus do Worker (observabilidade mínima — Fase 6 / plano).
 *
 * Exposto em `GET /metrics` pelo health-server. Além das métricas padrão de
 * processo (event loop, GC, memória), publica dois sinais específicos do
 * domínio: o estado da conexão WhatsApp (base do Alerta de Infra "worker
 * desconectado") e o total de Detecções produzidas.
 */
export const registry = new Registry();

registry.setDefaultLabels({ app: 'nossoradar-worker' });
collectDefaultMetrics({ register: registry, prefix: 'nossoradar_worker_' });

/**
 * Estado da Sessão WhatsApp como gauge 0/1 (1 = conectado). É o sinal que a
 * PrometheusRule usa para o alerta "worker desconectado do WhatsApp".
 */
export const whatsappConnectedGauge = new Gauge({
  name: 'nossoradar_worker_whatsapp_connected',
  help: 'Conexão do worker ao WhatsApp: 1 = conectado, 0 = desconectado.',
  registers: [registry],
});

/**
 * Estado detalhado da conexão como gauge rotulado por status (connected /
 * connecting / qr / disconnected) — útil para depurar sem perder o sinal
 * binário acima.
 */
export const whatsappConnectionStateGauge = new Gauge({
  name: 'nossoradar_worker_whatsapp_connection_state',
  help: 'Estado da conexão WhatsApp por status (1 = ativo).',
  labelNames: ['status'] as const,
  registers: [registry],
});

const CONNECTION_STATES = ['connected', 'connecting', 'qr', 'disconnected'] as const;
type ConnectionState = (typeof CONNECTION_STATES)[number];

/** Define o status atual, zerando os demais (one-hot) e o gauge binário. */
export function setWhatsappConnectionState(status: ConnectionState): void {
  for (const s of CONNECTION_STATES) {
    whatsappConnectionStateGauge.set({ status: s }, s === status ? 1 : 0);
  }
  whatsappConnectedGauge.set(status === 'connected' ? 1 : 0);
}

/** Total de Detecções produzidas pelo filtro (rotulado por grupo). */
export const detectionsCounter = new Counter({
  name: 'nossoradar_worker_detections_total',
  help: 'Total de Detecções geradas pelo worker.',
  labelNames: ['group_jid'] as const,
  registers: [registry],
});

/**
 * Mensagens recebidas de grupos MONITORADOS, por grupo e desfecho. Torna visível
 * a perda silenciosa: `no_text` (formato não mapeado / só-mídia), `no_match`
 * (texto sem keyword), `dedup` (reenvio colapsado) e `detected`. A razão
 * detected/total por grupo mede a eficácia das keywords; `no_text` alto sinaliza
 * um formato de mensagem que o `getMessageText` ainda não extrai.
 *
 * Cardinalidade controlada: `group_jid` é uma lista fechada (poucos monitorados) e
 * `outcome` tem 4 valores fixos. O tipo da mensagem (Object.keys) vai só no log.
 */
export const monitoredMessagesCounter = new Counter({
  name: 'nossoradar_worker_monitored_messages_total',
  help: 'Mensagens recebidas de grupos monitorados, por grupo e desfecho.',
  labelNames: ['group_jid', 'outcome'] as const,
  registers: [registry],
});

// Estado inicial: desconectado (antes do primeiro connect()).
setWhatsappConnectionState('disconnected');
