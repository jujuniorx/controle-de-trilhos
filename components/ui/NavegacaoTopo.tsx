'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const RAIZES = ['/patio', '/admin'];

const estiloBotao =
  'inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-line text-ink hover:bg-surface-2 active:scale-95';

/**
 * Botões fixos do topo: Voltar e Início.
 * Necessários porque, instalado como app (principalmente no iPhone), não existe
 * botão do navegador para voltar nem para trocar de área.
 * Voltar some nas telas iniciais de cada área (não há para onde voltar).
 */
export function NavegacaoTopo({ inicioArea, className = '' }: { inicioArea: '/patio' | '/admin'; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const naRaiz = RAIZES.includes(pathname.replace(/\/$/, ''));

  function voltar() {
    if (window.history.length > 1) router.back();
    else router.push(inicioArea);
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!naRaiz && (
        <button type="button" onClick={voltar} aria-label="Voltar" className={estiloBotao}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      )}
      <Link href="/" aria-label="Início: trocar entre Pátio e Administrativo" title="Início" className={estiloBotao}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 11l8-7 8 7M6 10v10h12V10" />
        </svg>
      </Link>
    </div>
  );
}
