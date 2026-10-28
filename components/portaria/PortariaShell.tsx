import type { ReactNode } from 'react';
import Link from 'next/link';
import { NavegacaoTopo } from '@/components/ui/NavegacaoTopo';
import { Logo } from '@/components/ui/Logo';
import { InstalarApp } from '@/components/InstalarApp';
import { AlternarTema } from '@/components/ui/AlternarTema';
import { BotaoSair } from '@/components/admin/BotaoSair';
import { GestosApp } from '@/components/ui/GestosApp';
import { BarraAbas, type Aba } from '@/components/ui/BarraAbas';
import { NavPortaria } from './NavPortaria';
import { ICONE_RECEBIMENTOS, ICONE_REMETIDOS, ICONE_TROCAR } from './icones';

const ABAS: Aba[] = [
  { href: '/portaria', rotulo: 'Carga', icone: ICONE_REMETIDOS(24) },
  { href: '/portaria/recebimentos', rotulo: 'Descarga', icone: ICONE_RECEBIMENTOS(24), prefixo: '/portaria/recebimentos' },
  { href: '/', rotulo: 'Trocar área', icone: ICONE_TROCAR(24) },
];

function iniciaisDe(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Avatar que abre o menu da conta. Vale em todas as larguras, então o Sair também
 * funciona no celular (antes ele só existia no menu lateral, que some abaixo de 1024 px).
 */
function MenuConta({ nome, iniciais, sair }: { nome: string; iniciais: string; sair: () => Promise<void> }) {
  return (
    <details className="portaria-menu">
      <summary className="portaria-avatar" aria-label={`Conta de ${nome}`}>
        {iniciais}
      </summary>
      <div className="portaria-menu-painel">
        <p className="portaria-menu-nome">{nome}</p>
        <p className="portaria-menu-papel">Portaria</p>
        <Link href="/" className="portaria-menu-item">
          Trocar área
        </Link>
        <BotaoSair acao={sair} className="portaria-menu-sair" />
      </div>
    </details>
  );
}

export function PortariaShell({ nome, sair, children }: { nome: string; sair: () => Promise<void>; children: ReactNode }) {
  const iniciais = iniciaisDe(nome) || '?';
  return (
    <div className="portaria-shell area-admin com-abas flex min-h-screen flex-col bg-background lg:flex-row">
      <GestosApp />
      <header className="ct-topbar relative flex h-14 flex-none items-center justify-between px-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-[84px]">
            <NavegacaoTopo inicioArea="/portaria" />
          </div>
          <span className="font-condensed text-base font-bold uppercase tracking-wide text-ink">Portaria</span>
        </div>
        <div className="flex items-center gap-2">
          <AlternarTema padrao="claro" />
          <MenuConta nome={nome} iniciais={iniciais} sair={sair} />
        </div>
      </header>

      <aside className="ct-sidebar hidden w-[248px] flex-none flex-col lg:flex">
        <div className="ct-sidebar-logo">
          <Logo size={32} subtitle="Portaria" />
        </div>
        <NavPortaria className="flex flex-1 flex-col gap-0.5 py-2" />
        <div className="ct-sidebar-footer">
          <div className="ct-user">
            <span className="ct-user-avatar" aria-hidden="true">{iniciais}</span>
            <div className="ct-user-dados">
              <span className="ct-user-nome">{nome}</span>
              <span className="ct-user-papel">Portaria</span>
            </div>
          </div>
          <div className="ct-user-acoes">
            <BotaoSair acao={sair} />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="ct-topbar hidden h-[52px] flex-none items-center justify-between gap-3 px-6 lg:flex">
          <NavegacaoTopo inicioArea="/portaria" />
          <div className="flex items-center gap-3">
            <AlternarTema padrao="claro" />
            <MenuConta nome={nome} iniciais={iniciais} sair={sair} />
          </div>
        </header>
        <InstalarApp />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <BarraAbas abas={ABAS} raiz="/portaria" />
    </div>
  );
}
