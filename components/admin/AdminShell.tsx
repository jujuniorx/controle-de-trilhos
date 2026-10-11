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
    <div className="area-admin flex min-h-screen flex-col bg-background md:flex-row">
      <header className="ct-topbar relative flex h-14 flex-none items-center justify-between px-3 md:hidden">
        <div className="flex items-center gap-2">
          <MobileNav dono={ehDono} />
          <NavegacaoTopo inicioArea="/admin" />
        </div>
        <div className="flex items-center gap-3">
          <AlternarTema padrao="claro" />
          <Link href="/admin/trocar-senha" className="text-xs text-ink-dim underline hover:text-ink">
            Trocar senha
          </Link>
        </div>
      </header>

      <aside className="ct-sidebar hidden w-[248px] flex-none flex-col md:flex">
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
        <header className="ct-topbar hidden h-[52px] flex-none items-center justify-between gap-3 px-6 md:flex">
          <NavegacaoTopo inicioArea="/admin" />
          <div className="flex items-center gap-3">
            <AlternarTema padrao="claro" />
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-white">
              {iniciaisDe(nome) || '?'}
            </span>
            <span className="text-sm font-semibold text-ink">{nome}</span>
          </div>
        </header>
        <InstalarApp />
        {ehDono && <MenuExcluir />}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
