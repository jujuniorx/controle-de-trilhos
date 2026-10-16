'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ICONE_RECEBIMENTOS, ICONE_REMETIDOS } from './icones';

/** Menu lateral da Portaria (telas médias e grandes). No celular vale a barra de abas. */
export function NavPortaria({ className }: { className?: string }) {
  const pathname = usePathname().replace(/\/$/, '');
  const remetidosAtivo = pathname === '/portaria';
  const recebimentosAtivo = pathname.startsWith('/portaria/recebimentos');
  return (
    <nav className={`ct-sidebar-nav ${className ?? ''}`} aria-label="Seções da Portaria">
      <span className="nav-section">Menu</span>
      <Link href="/portaria" data-active={remetidosAtivo}>
        <span className="nav-icone">{ICONE_REMETIDOS(18)}</span>
        Carga
      </Link>
      <Link href="/portaria/recebimentos" data-active={recebimentosAtivo}>
        <span className="nav-icone">{ICONE_RECEBIMENTOS(18)}</span>
        Descarga
      </Link>
    </nav>
  );
}
