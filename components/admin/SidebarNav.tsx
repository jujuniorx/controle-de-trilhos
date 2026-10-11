'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV_ITEMS = [
  { href: '/admin', label: 'Pendências' },
  { href: '/admin/relatorios', label: 'Relatórios' },
] as const;

/** Itens extras, só para o DONO. */
export const NAV_ITEMS_DONO = [
  { href: '/admin/usuarios', label: 'Usuários' },
  { href: '/admin/auditoria', label: 'Auditoria' },
] as const;

const tracos = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ICONES: Record<string, ReactNode> = {
  '/admin': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M4 13l3-8h10l3 8M4 13v6h16v-6M4 13h4l1 2h6l1-2h4" />
    </svg>
  ),
  '/admin/relatorios': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  '/admin/usuarios': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M17 11a3 3 0 1 0 0-6M18.5 14.7c1.6.7 2.7 2.2 3 4.3" />
    </svg>
  ),
  '/admin/auditoria': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM9 12l2 2 4-4" />
    </svg>
  ),
};

export function SidebarNav({ onNavigate, className, dono }: { onNavigate?: () => void; className?: string; dono?: boolean }) {
  const pathname = usePathname();

  function item(i: { href: string; label: string }) {
    const ativo = i.href === '/admin' ? pathname === '/admin' : pathname === i.href || pathname.startsWith(`${i.href}/`);
    return (
      <Link key={i.href} href={i.href} data-active={ativo} onClick={onNavigate}>
        <span className="nav-icone">{ICONES[i.href]}</span>
        {i.label}
      </Link>
    );
  }

  return (
    <nav className={`ct-sidebar-nav ${className ?? ''}`}>
      <span className="nav-section">Menu</span>
      {NAV_ITEMS.map(item)}
      {dono && (
        <>
          <span className="nav-section">Administração do sistema</span>
          {NAV_ITEMS_DONO.map(item)}
        </>
      )}
    </nav>
  );
}
