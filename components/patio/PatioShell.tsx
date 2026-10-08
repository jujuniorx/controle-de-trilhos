import type { ReactNode } from 'react';
import { IndicadorSincronizacao } from '@/components/IndicadorSincronizacao';

export function PatioShell({ children }: { children: ReactNode }) {
  return (
    <div className="area-patio flex min-h-screen flex-col bg-patio-mist">
      <header className="flex h-14 flex-none items-center gap-3 border-b-4 border-patio-steel bg-patio-gr px-4 text-white">
        <span className="font-condensed text-lg font-bold">Controle de Trilhos</span>
        <span className="rounded-md border border-white/30 px-2 py-0.5 text-xs font-semibold text-patio-steel-light">
          Pátio
        </span>
      </header>
      <IndicadorSincronizacao />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
