'use client';

import { useEffect, useState } from 'react';
import { IconeMais } from '@/components/icones/Icones';
import { FAB_REEMPREGO, FABRICANTES_CARGA, MAX_TLS_POR_LINHA, linhasDoBo } from '@/lib/estoque/cargasTrilheiro';
import { ORDEM_PERFIS, ROTULO_FABRICANTE } from '@/lib/estoque/trilhos';

export interface LinhaCargaInicial {
  perfil: string;
  reemprego: boolean;
  fabricante: string | null;
  quantidade: number;
}

interface Linha {
  id: number;
  perfil: string;
  fab: string;
  qtd: string;
}

const PERFIS_TLS = [...ORDEM_PERFIS].reverse();

const paraLinhas = (salvas: LinhaCargaInicial[]): Linha[] =>
  salvas.length > 0
    ? salvas.map((l, i) => ({ id: i + 1, perfil: l.perfil, fab: l.reemprego ? FAB_REEMPREGO : l.fabricante ?? '', qtd: String(l.quantidade) }))
    : [{ id: 1, perfil: 'TR68', fab: '', qtd: '' }];

/**
 * "TLS carregados neste B.O.": uma linha por perfil + fabricante (ou Reemprego) + quantidade.
 * Fica dentro do formulário da semana; os campos vão junto no "Salvar a semana".
 */
export function CargasTrilheiro({ trilheiro, boSalvo, inicial }: { trilheiro: string; boSalvo: string; inicial: LinhaCargaInicial[] }) {
  const [linhas, setLinhas] = useState<Linha[]>(() => paraLinhas(inicial));
  const [temBo, setTemBo] = useState(true);

  // O bloco só vale com a data do B.O. preenchida (os TLS saem do estoque nessa data).
  useEffect(() => {
    const campo = document.getElementById(`bo_${trilheiro}`) as HTMLInputElement | null;
    if (!campo) return;
    let anterior = campo.value.trim();
    const ver = () => {
      const bo = campo.value.trim();
      setTemBo(bo !== '');
      // Trocou o B.O. (giro novo): as linhas do giro antigo não vêm junto.
      if (bo !== anterior) setLinhas(paraLinhas(linhasDoBo(bo, boSalvo, inicial)));
      anterior = bo;
    };
    ver();
    campo.addEventListener('input', ver);
    campo.addEventListener('change', ver);
    return () => {
      campo.removeEventListener('input', ver);
      campo.removeEventListener('change', ver);
    };
  }, [trilheiro, boSalvo, inicial]);

  const mudar = (id: number, patch: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const total = linhas.reduce((a, l) => a + (/^\d+$/.test(l.qtd) ? parseInt(l.qtd, 10) : 0), 0);

  return (
    <fieldset className="space-y-2 rounded-lg border border-line p-3" disabled={!temBo}>
      <input type="hidden" name={`cargas_${trilheiro}_n`} value={linhas.length} />
      <legend className="px-1 text-sm font-semibold">
        TLS carregados neste B.O.
        <span className="ml-2 font-normal text-ink-muted">{temBo ? `${total} TLS no total` : 'Preencha a data do B.O.'}</span>
      </legend>
      {linhas.map((l, i) => (
        <div key={l.id} className="grid grid-cols-[1fr_1.4fr_5.5rem_auto] items-center gap-2">
          <select name={`carga_${trilheiro}_${i}_perfil`} aria-label={`Perfil, linha ${i + 1}`} className="h-11" value={l.perfil} onChange={(e) => mudar(l.id, { perfil: e.target.value })}>
            {PERFIS_TLS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select name={`carga_${trilheiro}_${i}_fab`} aria-label={`Fabricante, linha ${i + 1}`} className="h-11" value={l.fab} onChange={(e) => mudar(l.id, { fab: e.target.value })}>
            <option value="">Fabricante</option>
            {FABRICANTES_CARGA.map((f) => (
              <option key={f} value={f}>
                {ROTULO_FABRICANTE[f]}
              </option>
            ))}
            <option value={FAB_REEMPREGO}>Reemprego</option>
          </select>
          <input
            name={`carga_${trilheiro}_${i}_qtd`}
            aria-label={`Quantidade de TLS, linha ${i + 1}`}
            inputMode="numeric"
            placeholder="TLS"
            className="h-11 text-right"
            value={l.qtd}
            onChange={(e) => mudar(l.id, { qtd: e.target.value.replace(/\D/g, '').slice(0, 2) })}
            max={MAX_TLS_POR_LINHA}
          />
          <button
            type="button"
            className="h-11 px-2 text-sm text-bad"
            aria-label={`Tirar a linha ${i + 1}`}
            onClick={() => setLinhas((ls) => (ls.length > 1 ? ls.filter((x) => x.id !== l.id) : [{ ...l, fab: '', qtd: '' }]))}
          >
            Tirar
          </button>
        </div>
      ))}
      <button
        type="button"
        className="inline-flex h-10 items-center gap-1 text-sm font-semibold text-primary"
        onClick={() => setLinhas((ls) => [...ls, { id: Math.max(...ls.map((x) => x.id)) + 1, perfil: ls[ls.length - 1]?.perfil ?? 'TR68', fab: '', qtd: '' }])}
      >
        <IconeMais size={16} /> Adicionar perfil
      </button>
    </fieldset>
  );
}
