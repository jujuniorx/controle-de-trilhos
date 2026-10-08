'use client';

import Link from 'next/link';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Pendências' },
  { href: '/admin/relatorios', label: 'Relatórios' },
] as const;

export function MobileNav() {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={aberto}
        className="grid h-10 w-10 place-items-center rounded text-white hover:bg-white/10"
        onClick={() => setAberto((v) => !v)}
      >
        <span aria-hidden className="text-2xl leading-none">
          {aberto ? '✕' : '☰'}
        </span>
      </button>
      {aberto && (
        <nav className="absolute inset-x-0 top-full z-10 flex flex-col gap-1 border-t border-white/10 bg-admin-navy px-2 py-2 shadow-lg">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-4 py-3 text-base text-neutral-200 hover:bg-white/10"
              onClick={() => setAberto(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
