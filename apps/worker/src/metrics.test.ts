import { describe, expect, it } from 'vitest';

import {
  detectionsCounter,
  registry,
  setWhatsappConnectionState,
  whatsappConnectedGauge,
} from './metrics.js';

describe('métricas do worker', () => {
  it('expõe o registro com default metrics + sinais de domínio', async () => {
    const text = await registry.metrics();
    expect(text).toContain('nossoradar_worker_process_cpu_seconds_total');
    expect(text).toContain('nossoradar_worker_whatsapp_connected');
    expect(text).toContain('nossoradar_worker_detections_total');
  });

  it('o gauge binário reflete o estado one-hot da conexão', async () => {
    setWhatsappConnectionState('connected');
    expect(await whatsappConnectedGauge.get().then((m) => m.values[0]?.value)).toBe(1);

    setWhatsappConnectionState('disconnected');
    expect(await whatsappConnectedGauge.get().then((m) => m.values[0]?.value)).toBe(0);
  });

  it('o contador de Detecções incrementa por grupo', async () => {
    detectionsCounter.inc({ group_jid: 'teste@g.us' });
    const text = await registry.metrics();
    expect(text).toMatch(/nossoradar_worker_detections_total\{[^}]*group_jid="teste@g\.us"[^}]*\} 1/);
  });
});
