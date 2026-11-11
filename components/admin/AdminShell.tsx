import Link from 'next/link';
import type { ReactNode } from 'react';
import { NavegacaoTopo } from '@/components/ui/NavegacaoTopo';
import { MobileNav } from './MobileNav';
import { SidebarNav } from './SidebarNav';
import { Logo } from '@/components/ui/Logo';
import { MenuExcluir } from '@/components/admin/MenuExcluir';
import { InstalarApp } from '@/components/InstalarApp';
import { AlternarTema } from '@/components/ui/AlternarTema';
import { BotaoSair } from '@/components/admin/BotaoSair';
import { GestosApp } from '@/components/ui/GestosApp';
import { BarraAbas, type Aba } from '@/components/ui/BarraAbas';
import { SwipeAdmin } from './SwipeAdmin';
import { TrilhaTopo } from './TrilhaTopo';

/** Seções das abas da barra de baixo, na ordem em que o deslizar passa de uma para outra. */
const ROTAS_SWIPE = ['/admin', '/admin/relatorios', '/admin/portaria', '/admin/usina'];

const tracos = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ICONES_NAV = {
  inicio: (
    <svg width="24" height="24" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M4 13l3-8h10l3 8M4 13v6h16v-6M4 13h4l1 2h6l1-2h4" />
    </svg>
  ),
  relatorios: (
    <svg width="24" height="24" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  informativo: (
    <svg width="24" height="24" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />
    </svg>
  ),
  visao: (
    <svg width="24" height="24" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
  portaria: (
    <svg width="24" height="24" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0-.01M17 18.5a1.5 1.5 0 1 0 0-.01" />
    </svg>
  ),
  usina: (
    <svg width="24" height="24" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M3 21V10l6 4V10l6 4V6h6v15zM7 21v-3M11 21v-3M15 21v-3" />
    </svg>
  ),
  usuarios: (
    <svg width="24" height="24" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M17 11a3 3 0 1 0 0-6M18.5 14.7c1.6.7 2.7 2.2 3 4.3" />
    </svg>
  ),
};

function abasDoAdmin(): Aba[] {
  // Cinco vagas na barra: as seções do dia a dia; o resto (Informativo, Visão geral, Usuários...) fica em Mais.
  return [
    { href: '/admin', rotulo: 'Pendências', icone: ICONES_NAV.inicio },
    { href: '/admin/relatorios', rotulo: 'Relatórios', icone: ICONES_NAV.relatorios },
    { href: '/admin/portaria', rotulo: 'Portaria', icone: ICONES_NAV.portaria },
    { href: '/admin/usina', rotulo: 'Usina', icone: ICONES_NAV.usina },
    {
      rotulo: 'Mais',
      icone: (
        <svg width="24" height="24" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
          <circle cx="5" cy="12" r="1.2" />
          <circle cx="12" cy="12" r="1.2" />
          <circle cx="19" cy="12" r="1.2" />
        </svg>
      ),
    },
  ];
}

function iniciaisDe(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');
}

export function AdminShell({ nome, ehDono = false, children }: { nome: string; ehDono?: boolean; children: ReactNode }) {
  return (
    <div className="area-admin com-abas flex min-h-screen flex-col bg-background md:flex-row">
      <GestosApp />
      <header className="ct-topbar relative flex h-14 flex-none items-center justify-between px-3 md:hidden">
        <div className="flex items-center gap-2">
          <MobileNav dono={ehDono} />
          <NavegacaoTopo inicioArea="/admin" />
        </div>
        <div className="flex items-center gap-3">
          <AlternarTema padrao="claro" />
          <span className="ct-user-avatar" aria-hidden="true">{iniciaisDe(nome) || '?'}</span>
        </div>
      </header>

      <aside className="ct-sidebar hidden w-[248px] flex-none flex-col md:sticky md:top-0 md:flex md:h-dvh md:overflow-y-auto">
        <div className="ct-sidebar-logo">
          <Logo size={32} subtitle="Administração" />
        </div>
        <SidebarNav dono={ehDono} className="flex flex-1 flex-col gap-0.5 py-2" />
        <div className="ct-sidebar-footer">
          <div className="ct-user">
            <span className="ct-user-avatar" aria-hidden="true">{iniciaisDe(nome) || '?'}</span>
            <div className="ct-user-dados">
              <span className="ct-user-nome">{nome}</span>
              <span className="ct-user-papel">{ehDono ? 'Dono do sistema' : 'Administrativo'}</span>
            </div>
          </div>
          <div className="ct-user-acoes">
            <Link href="/admin/trocar-senha" className="ct-user-link">
              Trocar minha senha
            </Link>
            <BotaoSair />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="ct-topbar sticky top-0 z-30 hidden h-[52px] flex-none items-center justify-between gap-3 px-6 md:flex">
          <div className="flex min-w-0 items-center gap-3">
            <NavegacaoTopo inicioArea="/admin" />
            <TrilhaTopo />
          </div>
          <div className="flex items-center gap-3">
            <AlternarTema padrao="claro" />
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-white">
              {iniciaisDe(nome) || '?'}
            </span>
            <span className="text-sm font-semibold text-ink">{nome}</span>
          </div>
        </header>
        <InstalarApp />
        <MenuExcluir />
        <main className="pagina-admin min-w-0 flex-1">
          <SwipeAdmin rotas={ROTAS_SWIPE}>{children}</SwipeAdmin>
        </main>
      </div>
      <BarraAbas abas={abasDoAdmin()} raiz="/admin" />
    </div>
  );
}
