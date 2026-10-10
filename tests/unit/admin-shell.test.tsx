import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AdminShell } from '@/components/admin/AdminShell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/admin/relatorios',
}));

describe('AdminShell', () => {
  afterEach(cleanup);

  it('renderiza só os dois destinos reais do menu (Pendências e Relatórios)', () => {
    render(<AdminShell nome="Fulano de Tal">conteúdo</AdminShell>);
    expect(screen.getByRole('link', { name: 'Pendências' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: 'Relatórios' })).toHaveAttribute('href', '/admin/relatorios');
    // Itens do protótipo sem página real — nunca devem aparecer como link.
    expect(screen.queryByRole('link', { name: 'Conferência' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Histórico' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Configurações' })).toBeNull();
  });

  it('mostra o nome do admin logado, o link de trocar senha e renderiza os filhos', () => {
    render(<AdminShell nome="Fulano de Tal">área de conteúdo</AdminShell>);
    expect(screen.getAllByText('Fulano de Tal').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Trocar minha senha' })).toHaveAttribute('href', '/admin/trocar-senha');
    expect(screen.getByText('área de conteúdo')).toBeTruthy();
  });
});
