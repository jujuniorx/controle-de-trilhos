'use client';

import { useState } from 'react';
import { fmtMetros } from '@/lib/format';

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
      <div className="medicao-row">
        <span>
          <span className="medicao-num">{numero}.</span>{' '}
          {quantidade > 1 ? `${quantidade} × ${fmtMetros(comprimento)} m` : `${fmtMetros(comprimento)} m`}
        </span>
        <span className="flex items-center gap-2">
          {(quantidade > 1 || classificacaoSC) && (
            <span className="medicao-val">
              {quantidade > 1 ? `${fmtMetros(metros)} m` : ''}{classificacaoSC ? ` ${classificacaoSC}` : ''}
            </span>
          )}
          <button type="button" className="text-sm font-semibold text-accent underline" onClick={() => setEditando((v) => !v)} disabled={ocupado}>
            {editando ? 'Fechar' : 'Corrigir'}
          </button>
          {confirmarApagar ? (
            <button type="button" className="text-sm font-semibold text-bad underline" onClick={apagar} disabled={ocupado}>
              Toque de novo para apagar
            </button>
          ) : (
            <button type="button" className="text-sm text-bad underline" onClick={() => setConfirmarApagar(true)} disabled={ocupado}>
              Apagar
            </button>
          )}
        </span>
      </div>

      {editando && (
        <div className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
          {erro && <p role="alert" className="text-sm text-bad sm:col-span-3">{erro}</p>}
        </div>
      )}
      {!editando && erro && <p role="alert" className="text-sm text-bad">{erro}</p>}
    </div>
  );
}
