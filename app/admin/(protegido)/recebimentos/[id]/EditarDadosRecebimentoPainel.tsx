'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { editarDadosRecebimentoAction } from './actions';

export interface DadosEditaveis {
  dataMovimentacao: string; // YYYY-MM-DD ou ''
  origem: string;
  tipoTransporte: 'CAMINHAO' | 'VAGAO' | 'OUTRO';
  placaCavalo: string;
  placaCarreta: string;
  placaCarreta2: string;
  responsavelPatio: string;
  observacao: string;
}

export function EditarDadosRecebimentoPainel({ movimentacaoId, inicial }: { movimentacaoId: string; inicial: DadosEditaveis }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<DadosEditaveis>(inicial);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  function atualizar<K extends keyof DadosEditaveis>(campo: K, valor: DadosEditaveis[K]) {
    setDados((d) => ({ ...d, [campo]: valor }));
  }

  function cancelar() {
    setDados(inicial);
    setErro('');
    setAberto(false);
  }

  async function salvar() {
    setErro('');
    setSucesso(false);
    setEnviando(true);
    const r = await editarDadosRecebimentoAction(movimentacaoId, dados);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro ?? 'Não foi possível salvar.');
      return;
    }
    setAberto(false);
    setSucesso(true);
    router.refresh();
  }

  if (!aberto) {
    return (
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSucesso(false); setAberto(true); }}>
          ✏️ Editar dados
        </button>
        {sucesso && <span className="text-sm text-ok">Dados salvos.</span>}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded border p-4" style={{ borderColor: 'var(--line)' }}>
      <p className="text-sm font-medium text-ink-muted">Editar dados do recebimento</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Data
          <input type="date" className="h-11 w-full" value={dados.dataMovimentacao} onChange={(e) => atualizar('dataMovimentacao', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Origem
          <input className="h-11 w-full" value={dados.origem} onChange={(e) => atualizar('origem', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Transporte
          <select className="h-11 w-full" value={dados.tipoTransporte} onChange={(e) => atualizar('tipoTransporte', e.target.value as DadosEditaveis['tipoTransporte'])}>
            <option value="CAMINHAO">Caminhão</option>
            <option value="VAGAO">Vagão</option>
            <option value="OUTRO">Outro</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Responsável (Pátio)
          <input className="h-11 w-full" value={dados.responsavelPatio} onChange={(e) => atualizar('responsavelPatio', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Cavalo
          <input className="h-11 w-full font-mono uppercase" maxLength={7} value={dados.placaCavalo} onChange={(e) => atualizar('placaCavalo', e.target.value.toUpperCase())} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Carreta 1
          <input className="h-11 w-full font-mono uppercase" maxLength={7} value={dados.placaCarreta} onChange={(e) => atualizar('placaCarreta', e.target.value.toUpperCase())} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Carreta 2
          <input className="h-11 w-full font-mono uppercase" maxLength={7} value={dados.placaCarreta2} onChange={(e) => atualizar('placaCarreta2', e.target.value.toUpperCase())} />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Observação do Pátio
          <textarea className="w-full" rows={2} maxLength={500} value={dados.observacao} onChange={(e) => atualizar('observacao', e.target.value)} />
        </label>
      </div>
      {erro && <p className="text-sm text-danger">{erro}</p>}
      <p className="text-xs text-ink-muted">Se o recebimento já estava conferido, ele volta para pendente de conferência após salvar.</p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={salvar} disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar dados'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={cancelar} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
