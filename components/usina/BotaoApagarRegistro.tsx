'use client';

import { useRef, useState, useTransition } from 'react';

/**
 * Apaga um registro da usina em dois toques (o primeiro pede confirmação).
 * O formulário envia os campos ocultos (id ou trilheiro) para a ação do servidor.
 */
export function BotaoApagarRegistro({
  acao,
  campos,
  rotulo = 'Apagar',
  rotuloConfirmar = 'Toque de novo para apagar',
  classe = 'text-sm text-bad underline',
}: {
  acao: (formData: FormData) => Promise<void>;
  campos: Record<string, string>;
  rotulo?: string;
  rotuloConfirmar?: string;
  classe?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, iniciar] = useTransition();

  function clicar() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setConfirmando(false);
    iniciar(() => {
      const fd = new FormData(formRef.current ?? undefined);
      void acao(fd);
    });
  }

  return (
    <form ref={formRef} className="inline">
      {Object.entries(campos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <button type="button" className={classe} disabled={ocupado} onClick={clicar}>
        {ocupado ? 'Apagando...' : confirmando ? rotuloConfirmar : rotulo}
      </button>
    </form>
  );
}
