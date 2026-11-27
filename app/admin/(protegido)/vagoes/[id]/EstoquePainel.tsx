'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { definirMovimentaEstoqueAction } from '../actions';

/** Liga ou desliga a saída dos TLS do estoque para este remetido de vagão. */
export function EstoquePainel({ id, movimenta }: { id: string; movimenta: boolean }) {
  const router = useRouter();
  const [erro, setErro] = useState('');
  const [pendente, iniciar] = useTransition();

  const trocar = (valor: boolean) =>
    iniciar(async () => {
      setErro('');
      try {
        const r = await definirMovimentaEstoqueAction(id, valor);
        if (!r.ok) setErro(r.erro ?? 'Não foi possível alterar.');
        else router.refresh();
      } catch {
        setErro('Sem conexão. Tente de novo.');
      }
    });

  return (
    <div className="space-y-2">
      <div className="est-chips" role="group" aria-label="Movimenta o estoque">
        <button type="button" className="est-chip" aria-pressed={movimenta} disabled={pendente} onClick={() => !movimenta && trocar(true)}>
          Tira do estoque
        </button>
        <button type="button" className="est-chip" aria-pressed={!movimenta} disabled={pendente} onClick={() => movimenta && trocar(false)}>
          Não mexe no estoque
        </button>
      </div>
      <p className="text-sm text-ink-muted">
        {movimenta ? 'Os TLS deste B.O. saem do estoque de trilhos na data do remetido.' : 'Fica só registrado: o saldo de TLS não muda (o estoque já estava certo).'}
      </p>
      {erro && (
        <p role="alert" className="text-sm text-bad">
          {erro}
        </p>
      )}
    </div>
  );
}
