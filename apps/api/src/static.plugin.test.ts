import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Fixture: um dist mínimo da SPA (apenas index.html) num diretório temporário.
const distDir = mkdtempSync(join(tmpdir(), 'nossoradar-spa-'));
const SPA_HTML = '<!doctype html><html lang="pt-BR"><head><title>nossoRadar</title></head><body><div id="root"></div></body></html>';
writeFileSync(join(distDir, 'index.html'), SPA_HTML);
writeFileSync(join(distDir, 'app.js'), 'console.log("spa");');

// WEB_DIST_PATH precisa estar setado ANTES de env.ts/app.ts carregarem.
process.env.WEB_DIST_PATH = distDir;

// Mock mínimo do @nossoradar/db (sem Postgres real).
vi.mock('@nossoradar/db', () => ({
  notify: vi.fn(async () => undefined),
  getUserById: vi.fn(),
  upsertUser: vi.fn(),
  getConnectionState: vi.fn(),
  listWhatsappGroups: vi.fn(),
  listMonitoredGroups: vi.fn(),
  createMonitoredGroup: vi.fn(),
  setMonitoredGroupEnabled: vi.fn(),
  deleteMonitoredGroup: vi.fn(),
  addKeyword: vi.fn(),
  deleteKeyword: vi.fn(),
  listDetections: vi.fn(),
  getStats: vi.fn(),
  listen: vi.fn(async () => async () => undefined),
  closeDb: vi.fn(async () => undefined),
}));

const { buildApp } = await import('./app.js');

describe('staticPlugin (SPA dist presente)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(distDir, { recursive: true, force: true });
  });

  it('serve a SPA na raiz (history fallback) com text/html', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('<div id="root">');
  });

  it('GET /rota-spa (deep link) → 200 text/html (history fallback)', async () => {
    const res = await app.inject({ method: 'GET', url: '/deteccoes' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('<div id="root">');
  });

  it('serve assets estáticos reais do dist', async () => {
    const res = await app.inject({ method: 'GET', url: '/app.js' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('spa');
  });

  it('GET /api/inexistente → 404 JSON (NÃO cai no SPA fallback)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/inexistente' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json()).toEqual({ message: 'Não encontrado.' });
  });

  it('aplica CSP com as fontes esperadas', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeTypeOf('string');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('connect-src');
    expect(csp).toContain('ws:');
    expect(csp).toContain('wss:');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("img-src 'self' data:");
  });
});
