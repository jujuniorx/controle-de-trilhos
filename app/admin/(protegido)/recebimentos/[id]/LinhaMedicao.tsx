'use client';

import { useState } from 'react';
import { fmtMetros } from '@/lib/format';
import { IconeEditar, IconeLixeira, IconeFechar } from '@/components/icones/Icones';

interface LinhaMedicaoProps {
  movimentacaoId: string;
  medicaoId: string;
  numero: number;
  quantidade: number;
  comprimento: number;
  metros: number;
  classificacaoSC: string | null;
}

/** Converte "8,10" ou "8.10" em número com até 2 casas. */
function lerComprimento(texto: string): number | null {
  const t = texto.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Math.round(parseFloat(t) * 100) / 100;
  return Number.isFinite(n) && n > 0 && n <= 50 ? n : null;
}

/** Uma medição com botões de corrigir e apagar (só o administrativo). Toda mudança fica no histórico. */
export function LinhaMedicao({ movimentacaoId, medicaoId, numero, quantidade, comprimento, metros, classificacaoSC }: LinhaMedicaoProps) {
  const [editando, setEditando] = useState(false);
  const [qtd, setQtd] = useState(String(quantidade));
  const [comp, setComp] = useState(String(comprimento).replace('.', ','));
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const url = `/api/recebimentos/${movimentacaoId}/medicoes/${medicaoId}`;

  async function salvar() {
    setErro('');
    const c = lerComprimento(comp);
    const q = Math.floor(Number(qtd));
    if (c === null) return setErro('Comprimento entre 0,01 e 50 m, por exemplo 8,10.');
    if (!Number.isFinite(q) || q < 1) return setErro('Quantidade mínima é 1.');
    setOcupado(true);
    const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantidade: q, comprimento: c }) });
    setOcupado(false);
    if (!res.ok) return setErro((await res.json().catch(() => null))?.erro ?? 'Não foi possível salvar.');
    window.location.reload();
  }

  async function apagar() {
    setErro('');
    setOcupado(true);
    const res = await fetch(url, { method: 'DELETE' });
    setOcupado(false);
    if (!res.ok) return setErro((await res.json().catch(() => null))?.erro ?? 'Não foi possível apagar.');
    window.location.reload();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-line px-1.5 text-xs font-semibold tabular-nums text-ink-muted">{numero}</span>
          <span className="truncate font-medium tabular-nums text-ink">
            {quantidade > 1 ? `${quantidade} × ${fmtMetros(comprimento)} m` : `${fmtMetros(comprimento)} m`}
          </span>
          {(quantidade > 1 || classificacaoSC) && (
            <span className="text-sm tabular-nums text-ink-muted">
              {quantidade > 1 ? `= ${fmtMetros(metros)} m` : ''}
              {classificacaoSC ? <span className="ml-2 rounded-md border border-line px-1.5 py-0.5 text-xs font-semibold text-ink">{classificacaoSC}</span> : null}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="btn btn-ghost grid h-9 w-9 place-items-center p-0"
            onClick={() => setEditando((v) => !v)}
            disabled={ocupado}
            aria-label={editando ? 'Fechar correção' : 'Corrigir medição'}
            title={editando ? 'Fechar' : 'Corrigir'}
            aria-expanded={editando}
          >
            {editando ? <IconeFechar size={16} /> : <IconeEditar size={16} />}
          </button>

          {confirmarApagar ? (
            <div className="flex items-center gap-1.5">
              <button type="button" className="btn btn-danger h-9 px-3 text-xs" onClick={apagar} disabled={ocupado}>
                {ocupado ? 'Apagando…' : 'Confirmar'}
              </button>
              <button type="button" className="btn btn-ghost h-9 px-3 text-xs" onClick={() => setConfirmarApagar(false)} disabled={ocupado}>
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-ghost grid h-9 w-9 place-items-center p-0 text-bad"
              onClick={() => setConfirmarApagar(true)}
              disabled={ocupado}
              aria-label="Apagar medição"
              title="Apagar"
            >
              <IconeLixeira size={16} />
            </button>
          )}
        </div>
      </div>

      {editando && (
        <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="field">
            <label htmlFor={`q-${medicaoId}`}>Quantidade de barras</label>
            <input id={`q-${medicaoId}`} inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value)} className="h-11" />
          </div>
          <div className="field">
            <label htmlFor={`c-${medicaoId}`}>Comprimento (m)</label>
            <input id={`c-${medicaoId}`} inputMode="decimal" value={comp} onChange={(e) => setComp(e.target.value)} className="h-11" />
          </div>
          <button type="button" className="btn btn-primary h-11" onClick={salvar} disabled={ocupado}>
            {ocupado ? 'Salvando…' : 'Salvar correção'}
          </button>
          <p className="text-xs text-ink-muted sm:col-span-3">A alteração fica registrada no histórico do recebimento, com o valor antigo e o novo.</p>
          {erro && <p role="alert" className="text-sm font-medium text-bad sm:col-span-3">{erro}</p>}
        </div>
      )}
      {!editando && erro && <p role="alert" className="text-sm font-medium text-bad">{erro}</p>}
    </div>
  );
}
