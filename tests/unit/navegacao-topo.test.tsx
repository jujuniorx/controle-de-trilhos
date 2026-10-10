import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

let caminho = '/patio/remetidos';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => caminho,
}));

import { NavegacaoTopo } from '@/components/ui/NavegacaoTopo';

describe('NavegacaoTopo', () => {
  afterEach(cleanup);

  it('mostra Voltar e Início em telas internas', () => {
    caminho = '/patio/remetidos';
    render(<NavegacaoTopo inicioArea="/patio" />);
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Início/ })).toHaveAttribute('href', '/');
  });

  it('esconde Voltar na tela inicial da área, mas mantém Início', () => {
    caminho = '/patio';
    render(<NavegacaoTopo inicioArea="/patio" />);
    expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull();
    expect(screen.getByRole('link', { name: /Início/ })).toBeTruthy();
  });
});
