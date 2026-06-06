import { env } from './env.js';

/**
 * Worker WhatsApp (singleton — ADR-0004).
 *
 * Fase 2+ (a implementar):
 *  - conectar Baileys e restaurar a Sessão WhatsApp de WA_SESSION_PATH (PVC);
 *  - LISTEN config_changed / refresh_groups no Postgres (ADR-0003);
 *  - aplicar matchKeywords por JID (de @nossoradar/core);
 *  - inserir Detecção + NOTIFY detection_created;
 *  - enviar Alerta de Detecção ao Telegram.
 */
async function main(): Promise<void> {
  console.log('[worker] nossoRadar worker iniciando...');
  console.log(`[worker] sessão WhatsApp em: ${env.WA_SESSION_PATH}`);
  console.log('[worker] (stub) aguardando implementação da Fase 2.');
}

main().catch((err: unknown) => {
  console.error('[worker] erro fatal:', err);
  process.exit(1);
});
