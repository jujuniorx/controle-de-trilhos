import type { ReactNode } from 'react';
import { IndicadorSincronizacao } from '@/components/IndicadorSincronizacao';
import { InstalarApp } from '@/components/InstalarApp';
import { NavegacaoTopo } from '@/components/ui/NavegacaoTopo';
import { Logo } from '@/components/ui/Logo';
import { AlternarTema } from '@/components/ui/AlternarTema';
import { GavetaApp } from '@/components/ui/GavetaApp';
import { GestosApp } from '@/components/ui/GestosApp';

const ITENS_MENU = [
  { href: '/patio', rotulo: 'Início do Pátio' },
  { href: '/patio/recebimentos/novo', rotulo: 'Novo recebimento' },
  { href: '/patio/remetidos', rotulo: 'Remetidos' },
  { href: '/', rotulo: 'Trocar de área' },
];

export function PatioShell({ children }: { children: ReactNode }) {
  return (
    <div className="area-patio flex min-h-screen flex-col bg-background">
      <header className="ct-topbar flex min-h-[52px] flex-none flex-wrap items-center gap-2 px-4 py-2">
        <GavetaApp titulo="Pátio" itens={ITENS_MENU} />
        <NavegacaoTopo inicioArea="/patio" />
        <Logo size={28} subtitle="Pátio" />
        <AlternarTema padrao="escuro" className="ml-auto" />
      </header>
      <GestosApp raiz="/patio" />
      <IndicadorSincronizacao />
      <InstalarApp />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
