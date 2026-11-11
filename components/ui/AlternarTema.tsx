'use client';

import { useEffect, useState } from 'react';
import { ROTULOS_TEMA, TEMA_COOKIE, TEMA_PADRAO, TEMAS, temaValido, type Tema } from '@/lib/tema/tema';

/**
 * Seletor de tema do sistema. A escolha vale para todas as áreas: grava o cookie e
 * já atualiza o data-tema do <html> na hora, trocando o visual inteiro (cores, cards,
 * menu lateral, fundo e animações). Sem escolha, o padrão é o Azul-marinho.
 */
export function AlternarTema({ padrao = TEMA_PADRAO, className = '' }: { padrao?: Tema; className?: string }) {
  const [tema, setTema] = useState<Tema>(padrao);

  useEffect(() => {
    setTema(temaValido(document.documentElement.dataset.tema) ?? padrao);
  }, [padrao]);

  function escolher(proximo: Tema) {
    const aplicar = () => {
      document.documentElement.dataset.tema = proximo;
      document.cookie = `${TEMA_COOKIE}=${proximo}; path=/; max-age=31536000; samesite=lax`;
      setTema(proximo);
    };
    // Troca com o circulo que se expande a partir do seletor (como no Sales Dashboard).
    // Sem suporte ou com "reduzir movimento", troca direto.
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!doc.startViewTransition || reduzir) {
      aplicar();
      return;
    }
    const caixa = document.querySelector('.ct-seletor-tema select')?.getBoundingClientRect();
    const x = caixa ? caixa.left + caixa.width / 2 : window.innerWidth - 40;
    const y = caixa ? caixa.top + caixa.height / 2 : 30;
    document.documentElement.style.setProperty('--vt-x', `${x}px`);
    document.documentElement.style.setProperty('--vt-y', `${y}px`);
    doc.startViewTransition(aplicar);
  }

  return (
    <label className={`ct-seletor-tema ${className}`}>
      <span className="sr-only">Tema</span>
      <select
        value={tema}
        onChange={(evento) => escolher(evento.target.value as Tema)}
        aria-label="Tema do sistema"
        title="Tema do sistema"
      >
        {TEMAS.map((opcao) => (
          <option key={opcao} value={opcao}>
            {ROTULOS_TEMA[opcao]}
          </option>
        ))}
      </select>
    </label>
  );
}
