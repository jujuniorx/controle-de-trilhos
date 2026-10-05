import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Card } from '@/components/ui/Card';

describe('Card', () => {
  afterEach(cleanup);

  it('renderiza os filhos dentro de um container com borda e fundo de superfície', () => {
    render(<Card>Conteúdo do card</Card>);
    expect(screen.getByText('Conteúdo do card')).toBeTruthy();
  });

  it('aceita className extra sem substituir as classes base', () => {
    render(<Card className="mt-4">X</Card>);
    const el = screen.getByText('X');
    expect(el.className).toContain('mt-4');
    expect(el.className).toContain('border-line');
  });
});
