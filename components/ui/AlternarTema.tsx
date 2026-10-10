'use client';

import { useEffect, useState } from 'react';
import { TEMA_COOKIE, temaValido, type Tema } from '@/lib/tema/tema';

/**
 * Botão que alterna entre tema claro e escuro. `padrao` é o tema da área quando o
 * usuário ainda não escolheu (Admin = claro, Pátio = escuro). A escolha vale para
 * as duas áreas: grava o cookie e já atualiza o data-tema do <html> na hora.
 */
export function AlternarTema({ padrao, className = '' }: { padrao: Tema; className?: string }) {
  const [tema, setTema] = useState<Tema>(padrao);

  useEffect(() => {
    setTema(temaValido(document.documentElement.dataset.tema) ?? padrao);
  }, [padrao]);

  function alternar() {
    const proximo: Tema = tema === 'claro' ? 'escuro' : 'claro';
    document.documentElement.dataset.tema = proximo;
    document.cookie = `${TEMA_COOKIE}=${proximo}; path=/; max-age=31536000; samesite=lax`;
    setTema(proximo);
  }

  const paraEscuro = tema === 'claro';
  const rotulo = paraEscuro ? 'Mudar para o tema escuro' : 'Mudar para o tema claro';

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={rotulo}
      title={rotulo}
      className={`grid h-9 w-9 flex-none place-items-center rounded-full border border-line text-ink-muted hover:text-ink ${className}`}
    >
      {paraEscuro ? (
        // lua: o clique leva ao escuro
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        // sol: o clique leva ao claro
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}
