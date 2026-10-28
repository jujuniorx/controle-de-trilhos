'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { excluirMovimentacaoAction } from '@/app/admin/(protegido)/actions-excluir';

/**
 * Excluir uma movimentação (vai para a Lixeira, restaurável pelo dono), com motivo obrigatório.
 * Disponível para qualquer admin.
 */
export function BotaoExcluirMovimentacao({ id, rotulo }: { id: string; rotulo: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [pendente, iniciar] = useTransition();

  if (!aberto) {
    return (
      <button type="button" className="btn btn-sm border border-bad/40 bg-transparent text-bad" onClick={() => setAberto(true)}>
        Excluir
      </button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm">
      <p className="text-ink">
        <b>{rotulo}</b> sai da lista e vai para a Lixeira. Só o dono pode restaurar.
      </p>
      <label className="block">
        <span className="mb-1 block font-semibold text-ink">Motivo *</span>
        <textarea className="w-full" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={pendente} />
      </label>
      {erro && (
        <p role="alert" className="text-bad">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" disabled={pendente} onClick={() => setAberto(false)}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-sm text-bad"
          disabled={pendente || motivo.trim().length < 10}
          onClick={() =>
            iniciar(async () => {
              setErro('');
              try {
                const r = await excluirMovimentacaoAction(id, motivo);
                if (!r.ok) setErro(r.erro ?? 'Não foi possível excluir.');
                else router.refresh();
              } catch {
                setErro('Sem conexão. Tente de novo.');
              }
            })
          }
        >
          {pendente ? 'Excluindo...' : 'Excluir'}
        </button>
      </div>
    </div>
  );
}
