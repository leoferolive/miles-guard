import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import type { ProductSummary } from '@nossoradar/shared';

import { AppShell } from '@/components/app-shell';
import { deltaPct, formatBRL, formatShortDate, productPath } from '@/lib/format';
import { radarService } from '@/services/radar.service';

/** Tela Preços: produtos com histórico, do visto mais recentemente ao mais antigo. */
export const PrecosPage = () => {
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    radarService
      .listProducts(applied || undefined)
      .then((list) => {
        if (!cancelled) {
          setProducts(list);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Falha ao carregar os produtos.');
      });
    return () => {
      cancelled = true;
    };
  }, [applied]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setApplied(search.trim());
  };

  return (
    <AppShell title="Preços">
      {error && <div className="error-banner">{error}</div>}

      <form className="card" onSubmit={onSearch}>
        <div className="filters">
          <input
            className="input"
            type="search"
            placeholder="Buscar produto (ex.: 5800X3D, OneBlade)"
            aria-label="Buscar produto"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Buscar
          </button>
        </div>
      </form>

      {products === null ? (
        <div className="empty">Carregando…</div>
      ) : products.length === 0 ? (
        <div className="empty">Nenhum produto com histórico de preço ainda.</div>
      ) : (
        <div className="card product-list">
          <table className="product-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th className="num">Último</th>
                <th className="num">vs. mediana</th>
                <th className="num">Mediana</th>
                <th className="num">Menor</th>
                <th className="num">Ofertas</th>
                <th className="num">Visto em</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const delta = deltaPct(p.lastPrice, p.medianPrice);
                const isLowest = p.offers >= 2 && p.lastPrice <= p.minPrice;
                return (
                  <tr key={p.productKey}>
                    <td className="product-title">
                      <Link to={productPath(p.productKey)}>{p.title ?? p.productKey}</Link>
                    </td>
                    <td className="num">
                      {formatBRL(p.lastPrice)}
                      {isLowest && (
                        <span className="badge-lowest" title="Menor preço já visto">
                          🏆
                        </span>
                      )}
                    </td>
                    <td className={`num ${delta < 0 ? 'delta-down' : delta > 0 ? 'delta-up' : ''}`}>
                      {delta === 0 ? '=' : `${delta > 0 ? '+' : ''}${delta.toLocaleString('pt-BR')}%`}
                    </td>
                    <td className="num">{formatBRL(p.medianPrice)}</td>
                    <td className="num">{formatBRL(p.minPrice)}</td>
                    <td className="num">{p.offers}</td>
                    <td className="num faint">{formatShortDate(p.lastSeenAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
};
