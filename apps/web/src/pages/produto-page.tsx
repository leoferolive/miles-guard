import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { ProductHistory } from '@nossoradar/shared';

import { AppShell } from '@/components/app-shell';
import { PriceChart } from '@/components/price-chart';
import { deltaPct, formatBRL, formatShortDate } from '@/lib/format';
import { radarService } from '@/services/radar.service';

/** Histórico de preço de um produto: resumo, gráfico e todas as ofertas. */
export const ProdutoPage = () => {
  const { productKey = '' } = useParams();
  const [history, setHistory] = useState<ProductHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    setError(null);
    radarService
      .getProductHistory(productKey)
      .then((h) => {
        if (!cancelled) {
          setHistory(h);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Produto sem histórico de preço (ou falha ao carregar).');
      });
    return () => {
      cancelled = true;
    };
  }, [productKey]);

  const last = history?.points.at(-1);
  const delta = last && history ? deltaPct(last.price, history.stats.median) : 0;

  return (
    <AppShell
      title={history?.title ?? 'Histórico de preço'}
      actions={
        <Link className="btn btn-ghost btn-sm" to="/precos">
          ← Preços
        </Link>
      }
    >
      {error && <div className="error-banner">{error}</div>}
      {!history && !error && <div className="empty">Carregando…</div>}

      {history && last && (
        <>
          <div className="grid grid-stats price-stats">
            <div className="card">
              <div className="stat-value">{formatBRL(last.price)}</div>
              <div className="stat-label">
                Último · {formatShortDate(last.detectedAt)}{' '}
                <span className={delta < 0 ? 'delta-down' : delta > 0 ? 'delta-up' : ''}>
                  ({delta > 0 ? '+' : ''}
                  {delta.toLocaleString('pt-BR')}% vs. mediana)
                </span>
              </div>
            </div>
            <div className="card">
              <div className="stat-value">{formatBRL(history.stats.median)}</div>
              <div className="stat-label">Mediana</div>
            </div>
            <div className="card">
              <div className="stat-value delta-down">{formatBRL(history.stats.min)}</div>
              <div className="stat-label">Menor preço</div>
            </div>
            <div className="card">
              <div className="stat-value">{formatBRL(history.stats.max)}</div>
              <div className="stat-label">Maior preço</div>
            </div>
            <div className="card">
              <div className="stat-value">{history.stats.offers}</div>
              <div className="stat-label">Ofertas distintas</div>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Preço ao longo do tempo</div>
            <PriceChart points={history.points} median={history.stats.median} />
          </div>

          <div className="card product-list">
            <div className="section-title">Ofertas ({history.points.length})</div>
            <table className="product-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Grupo</th>
                  <th>Anúncio</th>
                  <th className="num">Preço</th>
                </tr>
              </thead>
              <tbody>
                {[...history.points].reverse().map((p) => (
                  <tr key={p.detectionId}>
                    <td className="faint">{new Date(p.detectedAt).toLocaleString('pt-BR')}</td>
                    <td>{p.groupName ?? '—'}</td>
                    <td className="product-title">{p.title ?? '—'}</td>
                    <td className={`num ${p.price === history.stats.min ? 'delta-down' : ''}`}>
                      {formatBRL(p.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
};
