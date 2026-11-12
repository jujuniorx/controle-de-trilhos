'use client';

import { useRef, type CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePilulaMenu } from '@/lib/ui/usePilulaMenu';
import { ICONES_NAV, NAV_ITEMS } from './navItens';


export function SidebarNav({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // Pílula que desliza até o item ativo (mede de novo se o menu mudar de tamanho ou o tema trocar).
  usePilulaMenu(navRef, pathname);

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
      {NAV_ITEMS.map((i, n) => item(i, n))}
    </nav>
  );
}
