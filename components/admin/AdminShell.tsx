import Link from 'next/link';
import type { ReactNode } from 'react';
import { NavegacaoTopo } from '@/components/ui/NavegacaoTopo';
import { ICONES_NAV as ICONES_MENU, NAV_ITEMS } from './navItens';
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
const ROTAS_SWIPE = ['/admin', '/admin/pendencias', '/admin/producao', '/admin/portaria', '/admin/usina'];

const tracos = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ICONES_NAV = {
  casa: (
    <svg width="24" height="24" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5" />
    </svg>
  ),
  producao: (
    <svg width="24" height="24" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4" />
    </svg>
  ),
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
  // Cinco seções do dia a dia na barra; as outras são abertas pela tela inicial (e pelo menu do topo).
  return [
    { href: '/admin', rotulo: 'Início', icone: ICONES_NAV.casa },
    { href: '/admin/pendencias', rotulo: 'Pendências', icone: ICONES_NAV.inicio },
    { href: '/admin/producao', rotulo: 'Produção', icone: ICONES_NAV.producao },
    { href: '/admin/portaria', rotulo: 'Portaria', icone: ICONES_NAV.portaria },
    { href: '/admin/usina', rotulo: 'Usina', icone: ICONES_NAV.usina },
  ];
}

/** Lista completa para telas largas (sem menu lateral): todas as seções na barra de baixo. */
function abasLargasDoAdmin(): Aba[] {
  return NAV_ITEMS.map((i) => ({ href: i.href, rotulo: i.label, icone: ICONES_MENU[i.href] }));
}

/** Menu da conta no topo (celular e telas largas): nome, trocar de área, trocar senha e sair. */
function MenuContaAdmin({ nome, iniciais, papel }: { nome: string; iniciais: string; papel: string }) {
  return (
    <details className="portaria-menu">
      <summary className="portaria-avatar" aria-label={`Conta de ${nome}`}>
        {iniciais}
      </summary>
      <div className="portaria-menu-painel">
        <p className="portaria-menu-nome">{nome}</p>
        <p className="portaria-menu-papel">{papel}</p>
        <Link href="/" className="portaria-menu-item">
          Trocar de área
        </Link>
        <Link href="/admin/trocar-senha" className="portaria-menu-item">
          Trocar minha senha
        </Link>
        <BotaoSair className="portaria-menu-sair" />
      </div>
    </details>
  );
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
        <div className="flex min-w-0 items-center gap-2">
          <NavegacaoTopo inicioArea="/admin" semInicio />
          <Logo size={28} subtitle="Administração" />
        </div>
        <div className="flex flex-none items-center gap-2">
          <AlternarTema />
          <MenuContaAdmin nome={nome} iniciais={iniciaisDe(nome) || '?'} papel={ehDono ? 'Dono do sistema' : 'Administrativo'} />
        </div>
      </header>

      {/* Sem menu lateral: a navegação é a barra de baixo, em todas as telas. */}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="ct-topbar sticky top-0 z-30 hidden h-[52px] flex-none items-center justify-between gap-3 px-6 md:flex">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size={30} subtitle="Administração" />
            <span className="h-6 w-px flex-none bg-line" aria-hidden="true" />
            <NavegacaoTopo inicioArea="/admin" semInicio />
            <TrilhaTopo />
          </div>
          <div className="flex items-center gap-3">
            <AlternarTema />
            <span className="text-sm font-semibold text-ink">{nome}</span>
            <MenuContaAdmin nome={nome} iniciais={iniciaisDe(nome) || '?'} papel={ehDono ? 'Dono do sistema' : 'Administrativo'} />
          </div>
        </header>
        <InstalarApp />
        <MenuExcluir />
        <main className="pagina-admin min-w-0 flex-1">
          <SwipeAdmin rotas={ROTAS_SWIPE}>{children}</SwipeAdmin>
        </main>
      </div>
      <BarraAbas abas={abasDoAdmin()} raiz="/admin" largura="celular" />
      <BarraAbas abas={abasLargasDoAdmin()} raiz="/admin" largura="larga" />
    </div>
  );
}
