'use client';

import { useState, type CSSProperties } from 'react';
import { IconeOlho } from '@/components/icones/Icones';

type Props = {
  id: string;
  name: string;
  required?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  inputMode?: 'numeric' | 'text';
  maxLength?: number;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Campo de senha (ou PIN) com o botão de olho para mostrar e ocultar.
 * O botão não é enviado com o formulário (type="button") e tem nome para leitor de tela.
 */
export function CampoSenha({ id, name, className = 'h-12', style, ...resto }: Props) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        id={id}
        name={name}
        type={mostrar ? 'text' : 'password'}
        className={`${className} min-w-0 flex-1`}
        style={style}
        {...resto}
      />
      <button
        type="button"
        className="btn btn-ghost h-12 w-12 flex-none px-0"
        onClick={() => setMostrar((m) => !m)}
        aria-pressed={mostrar}
        aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
        title={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
      >
        <IconeOlho size={22} ocultar={mostrar} />
      </button>
    </div>
  );
}
