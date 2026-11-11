'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

/**
 * Botão de enviar que mostra "em andamento" enquanto o formulário está salvando:
 * trava o segundo clique e gira o indicador (regra .btn[aria-busy] no app/temas.css).
 * Precisa ficar dentro do <form>.
 */
export function BotaoEnviar({ children, enviando, className = 'btn btn-primary' }: { children: ReactNode; enviando?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending && enviando ? enviando : children}
    </button>
  );
}
