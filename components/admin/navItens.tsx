import type { ReactNode } from 'react';

// Itens e icones do menu do Administrativo. Fica fora do SidebarNav ('use client') para o
// AdminShell (componente de servidor) poder usar as listas: valores exportados de um
// arquivo 'use client' nao podem ser lidos no servidor.

export const NAV_ITEMS = [
  { href: '/admin', label: 'Início' },
  { href: '/admin/pendencias', label: 'Pendências' },
  { href: '/admin/producao', label: 'Produção' },
  { href: '/admin/relatorios', label: 'Relatórios' },
  { href: '/admin/portaria', label: 'Portaria' },
  { href: '/admin/usina', label: 'Usina' },
  { href: '/admin/estoque', label: 'Estoque' },
] as const;

/** Itens extras, só para o DONO. */
export const NAV_ITEMS_DONO = [
  { href: '/admin/usuarios', label: 'Usuários' },
  { href: '/admin/lixeira', label: 'Lixeira' },
  { href: '/admin/pilhas', label: 'Pilhas do pátio' },
  { href: '/admin/auditoria', label: 'Auditoria' },
] as const;

const tracos = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const ICONES_NAV: Record<string, ReactNode> = {
  '/admin': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5" />
    </svg>
  ),
  '/admin/pendencias': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M4 13l3-8h10l3 8M4 13v6h16v-6M4 13h4l1 2h6l1-2h4" />
    </svg>
  ),
  '/admin/relatorios': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  '/admin/informativo': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />
    </svg>
  ),
  '/admin/portaria': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0-.01M17 18.5a1.5 1.5 0 1 0 0-.01" />
    </svg>
  ),
  '/admin/estoque': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10" />
    </svg>
  ),
  '/admin/usina': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M3 21V10l6 4V10l6 4V6h6v15zM7 21v-3M11 21v-3M15 21v-3" />
    </svg>
  ),
  '/admin/producao': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4" />
    </svg>
  ),
  '/admin/pilhas': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <rect x="3" y="14" width="18" height="6" rx="1" />
      <rect x="6" y="5" width="12" height="6" rx="1" />
    </svg>
  ),
  '/admin/dono': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
  '/admin/usuarios': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M17 11a3 3 0 1 0 0-6M18.5 14.7c1.6.7 2.7 2.2 3 4.3" />
    </svg>
  ),
  '/admin/lixeira': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </svg>
  ),
  '/admin/auditoria': (
    <svg width="18" height="18" viewBox="0 0 24 24" {...tracos} aria-hidden="true">
      <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM9 12l2 2 4-4" />
    </svg>
  ),
};

