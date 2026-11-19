'use client';

import { useActionState, useEffect, useRef } from 'react';
import { registrarMovimentoEstoqueAction } from '@/app/admin/(protegido)/estoque/areas-actions';
import type { ResultadoFormUsina } from '@/components/usina/FormularioUsina';
import { IconeFechar, IconeMais, IconeMenos } from '@/components/icones/Icones';

/**
 * Botão de entrada (+) ou baixa (−) de um item, que abre uma janelinha para confirmar a quantidade.
 * Baixa pede o motivo; entrada aceita a NF. Tudo vai para o histórico com quem lançou.
 */
export function MovimentoRapido({
  materialId,
  nome,
  unidade,
  tipo,
  sugestao,
  variante = 'icone',
}: {
  materialId: string;
  nome: string;
  /** Unidade já como aparece na tela ("m", "pares", "barras", "L"). */
  unidade: string;
  tipo: 'ENTRADA' | 'BAIXA';
  sugestao?: number;
  variante?: 'icone' | 'botao';
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const acaoSegura = async (anterior: ResultadoFormUsina | undefined, fd: FormData): Promise<ResultadoFormUsina> => {
    try {
      return await registrarMovimentoEstoqueAction(anterior, fd);
    } catch {
      return { ok: false, erro: 'Não foi salvo: a tela está desatualizada. Recarregue a página (F5) e lance de novo.' };
    }
  };
  const [estado, acao, pendente] = useActionState(acaoSegura, undefined);
  const entrada = tipo === 'ENTRADA';

  useEffect(() => {
    if (estado?.ok) {
      dialogo.current?.close();
      form.current?.reset();
    }
  }, [estado]);

  const rotulo = `${entrada ? 'Entrada' : 'Baixa'} de ${nome}`;
  return (
    <>
      {variante === 'icone' ? (
        <button type="button" className={`est-mov ${entrada ? 'est-mov-entrada' : ''}`} aria-label={rotulo} title={rotulo} onClick={() => dialogo.current?.showModal()}>
          {entrada ? <IconeMais size={16} /> : <IconeMenos size={16} />}
        </button>
      ) : (
        <button type="button" className={`btn h-11 w-full ${entrada ? 'est-mov-entrada' : 'btn-ghost'}`} style={entrada ? { border: '1px solid color-mix(in srgb, var(--ok) 45%, transparent)' } : undefined} onClick={() => dialogo.current?.showModal()}>
          {entrada ? <IconeMais size={16} /> : <IconeMenos size={16} />}
          {entrada ? 'Entrada' : 'Baixa'}
        </button>
      )}
      <dialog ref={dialogo} className="est-dialogo" aria-label={rotulo}>
        <form ref={form} action={acao} className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[.08em] text-ink-muted">{entrada ? 'Entrada' : 'Baixa'}</p>
              <p className="break-words text-lg font-bold text-ink">{nome}</p>
            </div>
            <button type="button" className="est-mov" aria-label="Fechar" onClick={() => dialogo.current?.close()}>
              <IconeFechar size={16} />
            </button>
          </div>
          <input type="hidden" name="materialId" value={materialId} />
          <input type="hidden" name="tipo" value={tipo} />
          <div className="field">
            <label htmlFor={`q-${materialId}-${tipo}`}>Quantidade ({unidade})</label>
            <input id={`q-${materialId}-${tipo}`} name="quantidade" inputMode="decimal" className="h-12 est-num" defaultValue={sugestao ? String(sugestao).replace('.', ',') : ''} required autoComplete="off" />
          </div>
          {entrada && (
            <div className="field">
              <label htmlFor={`nf-${materialId}`}>Nota fiscal (opcional)</label>
              <input id={`nf-${materialId}`} name="documento" className="h-12" autoComplete="off" />
            </div>
          )}
          <div className="field">
            <label htmlFor={`mot-${materialId}-${tipo}`}>{entrada ? 'Observação (opcional)' : 'Motivo da baixa'}</label>
            <input id={`mot-${materialId}-${tipo}`} name="motivo" className="h-12" required={!entrada} placeholder={entrada ? '' : 'Ex.: retirado para a Usina'} autoComplete="off" />
          </div>
          {estado && !estado.ok && <p role="alert" className="text-sm text-bad">{estado.erro}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-ghost h-12" onClick={() => dialogo.current?.close()}>Cancelar</button>
            <button type="submit" className="btn btn-primary h-12" disabled={pendente}>{pendente ? 'Salvando...' : entrada ? 'Lançar entrada' : 'Lançar baixa'}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
