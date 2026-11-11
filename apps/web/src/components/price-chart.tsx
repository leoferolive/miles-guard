import type { PricePoint } from '@nossoradar/shared';

import { formatBRL, formatShortDate } from '@/lib/format';

interface PriceChartProps {
  points: PricePoint[];
  median: number;
}

const W = 720;
const H = 280;
const PAD = { top: 20, right: 24, bottom: 34, left: 76 };

/**
 * Gráfico de preço no tempo (SVG puro, sem dependência): linha das ofertas em ordem
 * cronológica, mediana tracejada e o menor preço destacado. Cada ponto tem tooltip.
 */
export const PriceChart = ({ points, median }: PriceChartProps) => {
  if (points.length === 0) return null;

  const times = points.map((p) => new Date(p.detectedAt).getTime());
  const prices = points.map((p) => p.price);
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  // Folga vertical de 8% para os pontos não colarem nas bordas.
  const span = maxPrice - minPrice || maxPrice * 0.1 || 1;
  const yLow = minPrice - span * 0.08;
  const yHigh = maxPrice + span * 0.08;

  const x = (t: number) =>
    tMax === tMin
      ? PAD.left + (W - PAD.left - PAD.right) / 2
      : PAD.left + ((t - tMin) / (tMax - tMin)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - yLow) / (yHigh - yLow)) * (H - PAD.top - PAD.bottom);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(times[i] ?? 0)},${y(p.price)}`).join(' ');
  // Sem repetição: mediana costuma coincidir com o menor/maior preço.
  const ticks = [...new Set([maxPrice, median, minPrice])];

  return (
    <svg
      className="price-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Histórico de ${points.length} ofertas: menor ${formatBRL(minPrice)}, mediana ${formatBRL(median)}, maior ${formatBRL(maxPrice)}`}
    >
      {ticks.map((v) => (
        <g key={`tick-${v}`}>
          <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
          <text className="chart-axis" x={PAD.left - 10} y={y(v) + 4} textAnchor="end">
            {formatBRL(v)}
          </text>
        </g>
      ))}

      <line
        className="chart-median"
        x1={PAD.left}
        x2={W - PAD.right}
        y1={y(median)}
        y2={y(median)}
        data-testid="median-line"
      />
      <text className="chart-median-label" x={W - PAD.right} y={y(median) - 6} textAnchor="end">
        mediana
      </text>

      <path className="chart-line" d={path} />

      {points.map((p, i) => {
        const isMin = p.price === minPrice;
        return (
          <circle
            key={p.detectionId}
            className={isMin ? 'chart-point chart-point-min' : 'chart-point'}
            cx={x(times[i] ?? 0)}
            cy={y(p.price)}
            r={isMin ? 6 : 4}
            data-testid={isMin ? 'min-point' : 'point'}
          >
            <title>{`${formatShortDate(p.detectedAt)} · ${formatBRL(p.price)}${p.groupName ? ` · ${p.groupName}` : ''}`}</title>
          </circle>
        );
      })}

      <text className="chart-axis" x={PAD.left} y={H - 10} textAnchor="start">
        {formatShortDate(points[0]?.detectedAt ?? '')}
      </text>
      <text className="chart-axis" x={W - PAD.right} y={H - 10} textAnchor="end">
        {formatShortDate(points.at(-1)?.detectedAt ?? '')}
      </text>
    </svg>
  );
};
