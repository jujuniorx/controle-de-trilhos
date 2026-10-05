// tests/unit/ui-badge.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge', () => {
  afterEach(cleanup);

  it('renderiza o texto passado', () => {
    render(<Badge tone="warn">Pendente de conferência</Badge>);
    expect(screen.getByText('Pendente de conferência')).toBeTruthy();
  });

  it('aplica a classe de cor correspondente a cada tone', () => {
    const { rerender } = render(<Badge tone="ok">Conferido</Badge>);
    expect(screen.getByText('Conferido').className).toContain('bg-ok-light');

    rerender(<Badge tone="bad">Erro</Badge>);
    expect(screen.getByText('Erro').className).toContain('bg-bad-light');
  });
});
