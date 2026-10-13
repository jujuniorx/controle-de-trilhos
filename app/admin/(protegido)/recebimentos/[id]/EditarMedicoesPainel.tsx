'use client';

import { useState } from 'react';
import { fmtMetros } from '@/lib/format';
import type { Grupo, Medicao } from '@prisma/client';

interface EditarMedicoesPainelProps {
  grupos: (Grupo & { medicoes: Medicao[] })[];
  movimentacaoId: string;
  statusRecebimento: 'PENDENTE_CONFERENCIA' | 'CONFERIDO';
}

function parseComprimento(texto: string): { valor?: number; erro?: string } {
  let t = texto.replace(/\s/g, '').trim();
  if (!t) return { erro: 'Digite o comprimento, por exemplo 8,10.' };
  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { erro: 'Use números com até 2 casas decimais.' };
  const valor = Math.round(parseFloat(t) * 100) / 100;
  if (valor <= 0) return { erro: 'O comprimento precisa ser maior que zero.' };
  return { valor };
}

export function EditarMedicoesPainel({ grupos, movimentacaoId, statusRecebimento }: EditarMedicoesPainelProps) {
  const [mostraFormulario, setMostraFormulario] = useState(false);
  const [grupoId, setGrupoId] = useState<string>(grupos[0]?.id ?? '');
  const [quantidade, setQuantidade] = useState('1');
  const [comprimento, setComprimento] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const grupoAtivo = grupos.find((g) => g.id === grupoId);

  async function adicionarMedicao() {
    setErro('');
    const r = parseComprimento(comprimento);
    if (r.erro || r.valor == null) {
      setErro(r.erro ?? '');
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch(`/api/recebimentos/${movimentacaoId}/medicoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grupoId,
          quantidade: Math.max(1, Number(quantidade) || 1),
          comprimento: r.valor,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErro(data.erro ?? 'Erro ao adicionar medição');
        return;
      }

      // Sucesso — limpar formulário
      setQuantidade('1');
      setComprimento('');
      // Recarregar página (ou usar SWR para atualizar dados)
      window.location.reload();
    } catch (e) {
      setErro('Erro de rede ao adicionar medição');
    } finally {
      setEnviando(false);
    }
  }

  if (!mostraFormulario) {
    return (
      <button
        onClick={() => setMostraFormulario(true)}
        className="btn btn-secondary"
      >
        + Adicionar medição
      </button>
    );
  }

  return (
    <div className="card space-y-3">
      <h3 className="card-title">Adicionar medição</h3>

      {/* Seletor de grupo */}
      <div>
        <label className="block text-sm font-medium text-ink-muted mb-1">Grupo</label>
        <select
          value={grupoId}
          onChange={(e) => setGrupoId(e.target.value)}
          className="input"
        >
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.perfil} — {g.tipoMaterial}
            </option>
          ))}
        </select>
      </div>

      {/* Quantidade */}
      <div>
        <label className="block text-sm font-medium text-ink-muted mb-1">Quantidade</label>
        <input
          type="number"
          min="1"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          className="input"
          placeholder="1"
        />
      </div>

      {/* Comprimento */}
      <div>
        <label className="block text-sm font-medium text-ink-muted mb-1">Comprimento (m)</label>
        <input
          type="text"
          value={comprimento}
          onChange={(e) => setComprimento(e.target.value)}
          className="input"
          placeholder="8,10 ou 8.10"
          onKeyDown={(e) => {
            if (e.key === 'Enter') adicionarMedicao();
          }}
        />
        <p className="text-xs text-ink-dim mt-1">Ex.: 8,10 ou 11.95</p>
      </div>

      {erro && <div className="text-sm text-err">{erro}</div>}

      {/* Botões */}
      <div className="flex gap-2">
        <button
          onClick={adicionarMedicao}
          disabled={enviando || !comprimento}
          className="btn btn-primary"
        >
          {enviando ? 'Adicionando...' : 'Adicionar'}
        </button>
        <button
          onClick={() => setMostraFormulario(false)}
          className="btn btn-ghost"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
