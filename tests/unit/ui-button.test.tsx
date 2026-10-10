import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  afterEach(cleanup);

  it('renderiza um <button> com o texto e type informados quando não há href', () => {
    render(<Button type="submit">Entrar</Button>);
    const el = screen.getByRole('button', { name: 'Entrar' });
    expect(el.tagName).toBe('BUTTON');
    expect(el).toHaveAttribute('type', 'submit');
  });

  it('renderiza um link (<a>) quando href é informado, preservando o texto visível', () => {
    render(<Button href="/admin/relatorios">Relatórios</Button>);
    const el = screen.getByRole('link', { name: 'Relatórios' });
    expect(el).toHaveAttribute('href', '/admin/relatorios');
  });

  it('repassa disabled para o <button>', () => {
    render(<Button disabled>Salvando...</Button>);
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });
});
