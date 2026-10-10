import type { ReactNode } from 'react';
import { IndicadorSincronizacao } from '@/components/IndicadorSincronizacao';
import { Logo } from '@/components/ui/Logo';
import { AlternarTema } from '@/components/ui/AlternarTema';

export function PatioShell({ children }: { children: ReactNode }) {
  return (
    <div className="area-patio flex min-h-screen flex-col bg-background">
      <header className="ct-topbar flex min-h-[52px] flex-none flex-wrap items-center gap-2 px-4 py-2">
        <Logo size={28} subtitle="Pátio" />
        <AlternarTema padrao="escuro" className="ml-auto" />
      </header>
      <IndicadorSincronizacao />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
