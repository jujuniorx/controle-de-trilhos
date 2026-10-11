import type { ReactNode } from 'react';
import { IndicadorSincronizacao } from '@/components/IndicadorSincronizacao';
import { InstalarApp } from '@/components/InstalarApp';
import { NavegacaoTopo } from '@/components/ui/NavegacaoTopo';
import { Logo } from '@/components/ui/Logo';
import { AlternarTema } from '@/components/ui/AlternarTema';
import { BarraAbas, type Aba } from '@/components/ui/BarraAbas';
import { GestosApp } from '@/components/ui/GestosApp';
import { AquecerOffline } from '@/components/patio/AquecerOffline';

const tracos = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ABAS: Aba[] = [
  {
    href: '/patio',
    rotulo: 'Início',
    icone: (
      <svg width="24" height="24" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
        <path d="M4 11l8-7 8 7M6 10v10h12V10" />
      </svg>
    ),
  },
  {
    href: '/patio/recebimentos/novo',
    rotulo: 'Receber',
    prefixo: '/patio/recebimentos',
    icone: (
      <svg width="24" height="24" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    href: '/patio/remetidos',
    rotulo: 'Remetidos',
    icone: (
      <svg width="24" height="24" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
        <path d="M2 6h11v9H2zM13 9h4l3 3v3h-7z" />
        <circle cx="6.5" cy="17.5" r="1.8" />
        <circle cx="16.5" cy="17.5" r="1.8" />
      </svg>
    ),
  },
  {
    href: '/',
    rotulo: 'Trocar área',
    icone: (
      <svg width="24" height="24" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
        <path d="M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7" />
      </svg>
    ),
  },
];

export function PatioShell({ children }: { children: ReactNode }) {
  return (
    <div className="area-patio com-abas flex min-h-screen flex-col bg-background">
      <header className="ct-topbar flex min-h-[52px] flex-none flex-wrap items-center gap-2 px-4 py-2">
        <NavegacaoTopo inicioArea="/patio" />
        <Logo size={28} subtitle="Pátio" />
        <AlternarTema padrao="escuro" className="ml-auto" />
      </header>
      <GestosApp />
      <AquecerOffline />
      <IndicadorSincronizacao />
      <InstalarApp />
      <main className="min-w-0 flex-1">{children}</main>
      <BarraAbas abas={ABAS} raiz="/patio" />
    </div>
  );
}
