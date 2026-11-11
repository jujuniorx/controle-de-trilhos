'use client';

import { useRef, type CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePilulaMenu } from '@/lib/ui/usePilulaMenu';
import { ICONES_NAV, NAV_ITEMS, NAV_ITEMS_DONO } from './navItens';


export function SidebarNav({ onNavigate, className, dono }: { onNavigate?: () => void; className?: string; dono?: boolean }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // Pílula que desliza até o item ativo (mede de novo se o menu mudar de tamanho ou o tema trocar).
  usePilulaMenu(navRef, `${pathname}|${dono ? 1 : 0}`);

  function item(i: { href: string; label: string }, ordem: number) {
    const ativo = i.href === '/admin' ? pathname === '/admin' : pathname === i.href || pathname.startsWith(`${i.href}/`);
    const estilo = { '--i': ordem } as CSSProperties;
    return (
      <Link key={i.href} href={i.href} data-active={ativo} onClick={onNavigate} style={estilo}>
        <span className="nav-icone">{ICONES_NAV[i.href]}</span>
        {i.label}
      </Link>
    );
  }

  return (
    <nav ref={navRef} className={`ct-sidebar-nav ${className ?? ''}`}>
      <span className="nav-section">Menu</span>
      {/* Visão geral é o painel principal do dono: fica em primeiro. */}
      {dono && item({ href: '/admin/dono', label: 'Visão geral' }, 0)}
      {NAV_ITEMS.map((i, n) => item(i, n + (dono ? 1 : 0)))}
      {dono && (
        <>
          <span className="nav-section">Administração do sistema</span>
          {NAV_ITEMS_DONO.map((i, n) => item(i, n + 6))}
        </>
      )}
    </nav>
  );
}
