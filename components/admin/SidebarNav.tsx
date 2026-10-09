'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV_ITEMS = [
  { href: '/admin', label: 'Pendências' },
  { href: '/admin/relatorios', label: 'Relatórios' },
] as const;

export function SidebarNav({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={`ct-sidebar-nav ${className ?? ''}`}>
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} data-active={pathname === item.href} onClick={onNavigate}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
