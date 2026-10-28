'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ICONE_CARGA, ICONE_INICIO, ICONE_PILHAS, ICONE_RECEBER, ICONE_SAIDAS } from '@/components/patio/icones';

const ITENS = [
  { href: '/patio', rotulo: 'Início', icone: ICONE_INICIO, exato: true },
  { href: '/patio/recebimentos/novo', rotulo: 'Receber', icone: ICONE_RECEBER, prefixo: '/patio/recebimentos' },
  { href: '/patio/remetidos', rotulo: 'Cargas', icone: ICONE_CARGA, prefixo: '/patio/remetidos' },
  { href: '/patio/saidas', rotulo: 'Já saíram', icone: ICONE_SAIDAS },
  { href: '/patio/pilhas', rotulo: 'Pilhas', icone: ICONE_PILHAS },
];

/** Menu lateral do Pátio (telas grandes). No tablet e no celular vale a barra de abas. */
export function NavPatio({ className }: { className?: string }) {
  const pathname = usePathname().replace(/\/$/, '') || '/';
  return (
    <nav className={`ct-sidebar-nav ${className ?? ''}`} aria-label="Seções do Pátio">
      <span className="nav-section">Menu</span>
      {ITENS.map((i) => {
        const ativo = i.exato ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.prefixo ?? i.href}/`) || pathname === (i.prefixo ?? i.href);
        return (
          <Link key={i.href} href={i.href} data-active={ativo} aria-current={ativo ? 'page' : undefined}>
            <span className="nav-icone">{i.icone(18)}</span>
            {i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
