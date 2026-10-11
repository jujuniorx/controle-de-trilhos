'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarNav } from './SidebarNav';
import { BotaoSair } from './BotaoSair';
import { EVENTO_MENU } from '@/components/ui/GestosApp';

/** Botão ☰ do cabeçalho e a folha "Mais" (abre de baixo; também é aberta pela aba "Mais"). */
export function MobileNav({ dono }: { dono?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENTO_MENU, abrir);
    return () => window.removeEventListener(EVENTO_MENU, abrir);
  }, []);

  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  useEffect(() => {
    if (aberto) document.body.setAttribute('data-menu-aberto', '');
    else document.body.removeAttribute('data-menu-aberto');
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.removeAttribute('data-menu-aberto');
    };
  }, [aberto]);

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
        <>
          <div className="folha-fundo" onClick={() => setAberto(false)} />
          <div className="folha-mais" role="dialog" aria-label="Menu">
            <span className="folha-alca" aria-hidden="true" />
            <SidebarNav dono={dono} className="py-1" onNavigate={() => setAberto(false)} />
            <div className="ct-mobile-sair">
              <Link href="/admin/trocar-senha" className="ct-user-link" onClick={() => setAberto(false)}>
                Trocar minha senha
              </Link>
              <BotaoSair />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
