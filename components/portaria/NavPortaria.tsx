'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ICONE_RECEBIMENTOS, ICONE_REMETIDOS, ICONE_TROCAR } from './icones';
import { usePilulaMenu } from '@/lib/ui/usePilulaMenu';

/** Menu lateral da Portaria (telas grandes). Tem os mesmos itens da barra de abas do celular. */
export function NavPortaria({ className }: { className?: string }) {
  const pathname = usePathname().replace(/\/$/, '');
  const cargaAtiva = pathname === '/portaria';
  const descargaAtiva = pathname.startsWith('/portaria/recebimentos');
  const navRef = useRef<HTMLElement>(null);
  usePilulaMenu(navRef, pathname);
  return (
    <nav ref={navRef} className={`ct-sidebar-nav ${className ?? ''}`} aria-label="Seções da Portaria">
      <span className="nav-section">Menu</span>
      <Link href="/portaria" data-active={cargaAtiva} aria-current={cargaAtiva ? 'page' : undefined}>
        <span className="nav-icone">{ICONE_REMETIDOS(18)}</span>
        Carga
      </Link>
      <Link href="/portaria/recebimentos" data-active={descargaAtiva} aria-current={descargaAtiva ? 'page' : undefined}>
        <span className="nav-icone">{ICONE_RECEBIMENTOS(18)}</span>
        Descarga
      </Link>
      <Link href="/">
        <span className="nav-icone">{ICONE_TROCAR(18)}</span>
        Trocar área
      </Link>
    </nav>
  );
}
