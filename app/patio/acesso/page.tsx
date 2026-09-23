'use client';

import { useActionState } from 'react';
import { acessarPatioAction, type EstadoAcessoPatio } from './actions';

const ESTADO_INICIAL: EstadoAcessoPatio = {};

export default function AcessoPatioPage() {
  const [estado, formAction, enviando] = useActionState(acessarPatioAction, ESTADO_INICIAL);

  return (
    <form action={formAction}>
      <input name="pin" type="password" inputMode="numeric" required />
      <button type="submit" disabled={enviando}>
        Entrar
      </button>
      {/* Sem isto o operador não vê nem "Código inválido." nem a mensagem de
          bloqueio após 5 tentativas — num tablet compartilhado, o Pátio ficaria
          inacessível por 15 minutos e o único sintoma seria "o botão não faz nada". */}
      {estado.erro && (
        <p role="alert" className="text-sm text-red-700">
          {estado.erro}
        </p>
      )}
    </form>
  );
}
