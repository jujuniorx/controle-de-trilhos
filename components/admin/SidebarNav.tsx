'use client';

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

export function SidebarNav({ onNavigate, className, dono }: { onNavigate?: () => void; className?: string; dono?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={`ct-sidebar-nav ${className ?? ''}`}>
      {(dono ? [...NAV_ITEMS, ...NAV_ITEMS_DONO] : NAV_ITEMS).map((item) => (
        <Link key={item.href} href={item.href} data-active={pathname === item.href} onClick={onNavigate}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
