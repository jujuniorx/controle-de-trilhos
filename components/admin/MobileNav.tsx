'use client';

import { useState } from 'react';
import { SidebarNav } from './SidebarNav';
import { BotaoSair } from './BotaoSair';

export function MobileNav({ dono }: { dono?: boolean }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={aberto}
        className="grid h-10 w-10 place-items-center rounded text-ink hover:bg-surface-2"
        onClick={() => setAberto((v) => !v)}
      >
        <span aria-hidden className="text-2xl leading-none">
          {aberto ? '✕' : '☰'}
        </span>
      </button>
      {aberto && (
        <div className="ct-sidebar absolute inset-x-0 top-full z-50 shadow-lg">
          <SidebarNav dono={dono} className="py-2" onNavigate={() => setAberto(false)} />
          <div className="ct-mobile-sair"><BotaoSair /></div>
        </div>
      )}
    </div>
  );
}
