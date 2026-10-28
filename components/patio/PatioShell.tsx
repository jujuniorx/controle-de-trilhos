import type { ReactNode } from 'react';
import Link from 'next/link';
import { IndicadorSincronizacao } from '@/components/IndicadorSincronizacao';
import { InstalarApp } from '@/components/InstalarApp';
import { NavegacaoTopo } from '@/components/ui/NavegacaoTopo';
import { Logo } from '@/components/ui/Logo';
import { AlternarTema } from '@/components/ui/AlternarTema';
import { BarraAbas, type Aba } from '@/components/ui/BarraAbas';
import { GestosApp } from '@/components/ui/GestosApp';
import { AquecerOffline } from '@/components/patio/AquecerOffline';
import { NavPatio } from '@/components/patio/NavPatio';
import { ICONE_CARGA, ICONE_INICIO, ICONE_PILHAS, ICONE_RECEBER, ICONE_SAIDAS, ICONE_TROCAR_AREA } from '@/components/patio/icones';

/**
 * Abas do rodapé: as cinco telas de trabalho. "Trocar área" sai daqui de propósito —
 * é a ação que mais custa caro se tocada por engano, e fica só no cabeçalho.
 */
const ABAS: Aba[] = [
  { href: '/patio', rotulo: 'Início', icone: ICONE_INICIO(24) },
  { href: '/patio/recebimentos/novo', rotulo: 'Receber', prefixo: '/patio/recebimentos', icone: ICONE_RECEBER(24) },
  { href: '/patio/remetidos', rotulo: 'Cargas', prefixo: '/patio/remetidos', icone: ICONE_CARGA(24) },
  { href: '/patio/saidas', rotulo: 'Já saíram', icone: ICONE_SAIDAS(24) },
  { href: '/patio/pilhas', rotulo: 'Pilhas', icone: ICONE_PILHAS(24) },
];

export function PatioShell({ children }: { children: ReactNode }) {
  return (
    <div className="area-patio patio-shell com-abas flex min-h-screen flex-col bg-background xl:flex-row">
      <aside className="ct-sidebar hidden w-[240px] flex-none flex-col xl:flex">
        <div className="ct-sidebar-logo">
          <Logo size={32} subtitle="Pátio" />
        </div>
        <NavPatio className="flex flex-1 flex-col gap-0.5 py-2" />
        <div className="ct-sidebar-footer">
          <Link href="/" className="ct-sair">
            {ICONE_TROCAR_AREA(15)}
            Trocar área
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="ct-topbar flex min-h-[52px] flex-none flex-wrap items-center gap-2 px-4 py-2">
          <NavegacaoTopo inicioArea="/patio" />
          <div className="xl:hidden">
            <Logo size={28} subtitle="Pátio" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" aria-label="Trocar área" title="Trocar área" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink hover:bg-surface-2 active:scale-95">
              {ICONE_TROCAR_AREA(20)}
            </Link>
            <AlternarTema padrao="escuro" />
          </div>
        </header>
        <GestosApp />
        <AquecerOffline />
        <IndicadorSincronizacao />
        <InstalarApp />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <BarraAbas abas={ABAS} raiz="/patio" />
    </div>
  );
}
