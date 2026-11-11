'use client';

import { useEffect, useState } from 'react';
import { ROTULOS_TEMA, TEMA_COOKIE, TEMAS, temaValido, type Tema } from '@/lib/tema/tema';

/**
 * Seletor de tema do sistema. `padrao` é o tema da área quando o usuário ainda não
 * escolheu (Admin = claro, Pátio = escuro). A escolha vale para as duas áreas:
 * grava o cookie e já atualiza o data-tema do <html> na hora, trocando o visual
 * inteiro (cores, cards, menu lateral e animações).
 */
export function AlternarTema({ padrao, className = '' }: { padrao: Tema; className?: string }) {
  const [tema, setTema] = useState<Tema>(padrao);

  useEffect(() => {
    setTema(temaValido(document.documentElement.dataset.tema) ?? padrao);
  }, [padrao]);

  function escolher(proximo: Tema) {
    document.documentElement.dataset.tema = proximo;
    document.cookie = `${TEMA_COOKIE}=${proximo}; path=/; max-age=31536000; samesite=lax`;
    setTema(proximo);
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
