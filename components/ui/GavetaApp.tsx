'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { EVENTO_MENU } from '@/components/ui/GestosApp';

export type ItemGaveta = { href: string; rotulo: string };

/** Menu lateral (gaveta) com botão ☰; abre também com o gesto de deslizar da borda esquerda. */
export function GavetaApp({ titulo, itens }: { titulo: string; itens: ItemGaveta[] }) {
  const [aberta, setAberta] = useState(false);
  const pathname = usePathname();
  const x0 = useRef<number | null>(null);

  useEffect(() => {
    const abrir = () => setAberta(true);
    window.addEventListener(EVENTO_MENU, abrir);
    return () => window.removeEventListener(EVENTO_MENU, abrir);
  }, []);

  useEffect(() => {
    setAberta(false);
  }, [pathname]);

  useEffect(() => {
    if (aberta) document.body.setAttribute('data-gaveta-aberta', '');
    else document.body.removeAttribute('data-gaveta-aberta');
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberta(false);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.removeAttribute('data-gaveta-aberta');
    };
  }, [aberta]);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menu"
        aria-expanded={aberta}
        className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-line text-ink hover:bg-surface-2 active:scale-95"
        onClick={() => setAberta(true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <div className={`gaveta ${aberta ? 'gaveta-aberta' : ''}`} aria-hidden={!aberta}>
        <div className="gaveta-fundo" onClick={() => setAberta(false)} />
        <nav
          className="gaveta-painel"
          aria-label={titulo}
          onTouchStart={(e) => {
            x0.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const fim = e.changedTouches[0]?.clientX;
            if (x0.current !== null && fim !== undefined && x0.current - fim > 60) setAberta(false);
            x0.current = null;
          }}
        >
          <p className="gaveta-titulo">Menu</p>
          {itens.map((i) => (
            <Link key={i.href} href={i.href} className="gaveta-item" aria-current={pathname === i.href ? 'page' : undefined} tabIndex={aberta ? 0 : -1}>
              {i.rotulo}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
