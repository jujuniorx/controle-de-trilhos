import type { ReactNode } from 'react';
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
  { href: '/portaria', rotulo: 'Remetidos', icone: ICONE_REMETIDOS(24) },
  { href: '/portaria/recebimentos', rotulo: 'Recebimentos', icone: ICONE_RECEBIMENTOS(24), prefixo: '/portaria/recebimentos' },
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

export function PortariaShell({ nome, sair, children }: { nome: string; sair: () => Promise<void>; children: ReactNode }) {
  const iniciais = iniciaisDe(nome) || '?';
  return (
    <div className="area-admin com-abas flex min-h-screen flex-col bg-background md:flex-row">
      <GestosApp />
      <header className="ct-topbar relative flex h-14 flex-none items-center justify-between px-3 md:hidden">
        <div className="flex items-center gap-2">
          <NavegacaoTopo inicioArea="/portaria" />
          <span className="font-condensed text-base font-bold uppercase tracking-wide text-ink">Portaria</span>
        </div>
        <div className="flex items-center gap-3">
          <AlternarTema padrao="claro" />
          <span className="ct-user-avatar" aria-hidden="true">{iniciais}</span>
        </div>
      </header>

      <aside className="ct-sidebar hidden w-[248px] flex-none flex-col md:flex">
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
        <header className="ct-topbar hidden h-[52px] flex-none items-center justify-between gap-3 px-6 md:flex">
          <NavegacaoTopo inicioArea="/portaria" />
          <div className="flex items-center gap-3">
            <AlternarTema padrao="claro" />
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-white">{iniciais}</span>
            <span className="text-sm font-semibold text-ink">{nome}</span>
          </div>
        </header>
        <InstalarApp />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <BarraAbas abas={ABAS} raiz="/portaria" />
    </div>
  );
}
