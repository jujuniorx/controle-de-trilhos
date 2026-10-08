import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Pendências' },
  { href: '/admin/relatorios', label: 'Relatórios' },
] as const;

function iniciaisDe(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');
}

export function AdminShell({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <div className="area-admin flex min-h-screen bg-neutral-100">
      <aside className="flex w-60 flex-none flex-col bg-admin-navy px-2 py-6 text-white">
        <div className="px-3 font-condensed leading-none">
          <p className="text-lg font-semibold">CONTROLE</p>
          <p className="text-2xl font-bold">DE TRILHOS</p>
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-4 py-3 text-base text-neutral-200 hover:bg-white/10">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 flex-none items-center justify-end gap-3 bg-admin-navy px-6 text-white">
          <Link href="/admin/trocar-senha" className="text-xs text-neutral-300 underline hover:text-white">
            Trocar minha senha
          </Link>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold">
              {iniciaisDe(nome) || '?'}
            </span>
            <span className="text-sm font-semibold">{nome}</span>
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
