import { render, screen } from '@testing-library/react';
import { QRCodeSVG } from 'qrcode.react';
import { describe, expect, it } from 'vitest';

import type { ConnectionStatus } from '@nossoradar/shared';

import { ConnectionBadge } from './connection-badge';

describe('ConnectionBadge', () => {
  const cases: Array<[ConnectionStatus, string, string]> = [
    ['connected', 'Conectado', 'badge-connected'],
    ['connecting', 'Conectando', 'badge-connecting'],
    ['qr', 'Aguardando QR', 'badge-qr'],
    ['disconnected', 'Desconectado', 'badge-disconnected'],
  ];

  it.each(cases)('renderiza o status %s com rótulo e classe certos', (status, label, cssClass) => {
    const { container } = render(<ConnectionBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector(`.${cssClass}`)).not.toBeNull();
  });

  it('expõe role=status para leitores de tela', () => {
    render(<ConnectionBadge status="connected" />);
    expect(screen.getByRole('status')).toHaveTextContent('Conectado');
  });
});

describe('QR rendering (estado qr)', () => {
  it('renderiza um <svg> escaneável a partir da string de QR', () => {
    const { container } = render(<QRCodeSVG value="2@abc.def/ghi" size={200} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // o QR vira caminhos/retângulos no SVG (conteúdo de fato renderizado)
    expect(svg?.querySelectorAll('path, rect').length ?? 0).toBeGreaterThan(0);
  });
});
