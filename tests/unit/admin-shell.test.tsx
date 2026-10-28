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
    expect(screen.getAllByRole('link', { name: 'Pendências' })[0]).toHaveAttribute('href', '/admin');
    expect(screen.getAllByRole('link', { name: 'Relatórios' })[0]).toHaveAttribute('href', '/admin/relatorios');
    expect(screen.getAllByRole('link', { name: 'Informativo' })[0]).toHaveAttribute('href', '/admin/informativo');
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

describe('AdminShell — dono', () => {
  afterEach(cleanup);

  it('só o dono vê Usuários e Auditoria', () => {
    render(<AdminShell nome="Junior" ehDono>x</AdminShell>);
    expect(screen.getAllByRole('link', { name: 'Usuários' })[0]).toHaveAttribute('href', '/admin/usuarios');
    expect(screen.getAllByRole('link', { name: 'Auditoria' })[0]).toHaveAttribute('href', '/admin/auditoria');
    cleanup();
    render(<AdminShell nome="Paula">x</AdminShell>);
    expect(screen.queryByRole('link', { name: 'Usuários' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Auditoria' })).toBeNull();
  });
});

describe('AdminShell — organização do menu', () => {
  afterEach(cleanup);

  it('para o dono, Visão geral é o primeiro item do menu', () => {
    render(<AdminShell nome="Junior" ehDono>x</AdminShell>);
    const nav = document.querySelector('aside .ct-sidebar-nav');
    const primeiro = nav?.querySelector('a');
    expect(primeiro?.getAttribute('href')).toBe('/admin/dono');
  });

  it('para o admin comum, Visão geral não aparece', () => {
    render(<AdminShell nome="Paula">x</AdminShell>);
    expect(screen.queryByRole('link', { name: 'Visão geral' })).toBeNull();
  });

  it('mostra a trilha do topo com a seção atual', () => {
    render(<AdminShell nome="Paula">x</AdminShell>);
    const trilha = screen.getByRole('navigation', { name: 'Você está em' });
    expect(trilha.textContent).toContain('Relatórios');
  });
});
