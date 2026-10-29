'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconeFechar } from '@/components/icones/Icones';
import type { ResultadoRecebimentoPatio } from '@/app/patio/(protegido)/recebimentos/actions';

export interface ExcluirPatioBotaoProps {
  /** Nome do item, para a pergunta de confirmação (ex.: "o caminhão ABC-1234"). */
  nome: string;
  /** Texto curto do que é excluído (ex.: "esta chegada" ou "este recebimento"). */
  oQue: string;
  /** Id do item (passado ao servidor junto com o motivo). */
  alvoId: string;
  aoConfirmar: (id: string, motivo: string) => Promise<ResultadoRecebimentoPatio>;
}

/** Excluir pelo Pátio: pede a confirmação e o motivo. Quem é dono consegue restaurar pela lixeira. */
export function ExcluirPatioBotao({ nome, oQue, alvoId, aoConfirmar }: ExcluirPatioBotaoProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    if (motivo.trim().length < 10) {
      setErro('Escreva o motivo da exclusão.');
      return;
    }
    setErro('');
    iniciar(async () => {
      const r = await aoConfirmar(alvoId, motivo.trim());
      if (r.ok) router.refresh();
      else setErro(r.erro ?? 'Não foi possível excluir.');
    });
  }

  if (!aberto) {
    return (
      <button type="button" className="btn btn-ghost btn-sm text-bad" onClick={() => setAberto(true)}>
        Excluir
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-bad/50 p-3" role="group" aria-label={`Excluir ${oQue}`}>
      <p className="text-sm font-medium text-ink">
        Você tem certeza que quer excluir {oQue} ({nome})?
      </p>
      <p className="text-sm text-ink-muted">Ele sai da lista do Pátio. O dono pode restaurar pela lixeira.</p>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-ink">Motivo da exclusão</span>
        <textarea
          className="input w-full"
          rows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: cadastrado por engano, caminhão não veio"
          disabled={pendente}
        />
      </label>
      {erro && <p role="alert" className="text-sm text-bad">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-danger btn-sm" onClick={confirmar} disabled={pendente}>
          {pendente ? 'Excluindo…' : 'Sim, excluir'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAberto(false); setErro(''); }} disabled={pendente}>
          <IconeFechar size={14} /> Cancelar
        </button>
      </div>
    </div>
  );
}
