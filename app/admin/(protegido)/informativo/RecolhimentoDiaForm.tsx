'use client';

import { FormularioUsina } from '@/components/usina/FormularioUsina';
import { salvarRecolhimentoDiaAction } from './actions';

/** Lançamento do recolhido de W61 e W62 de um dia (em barras), feito pelo admin ou pela Priscila. */
export function RecolhimentoDiaForm({ data, w61, w62 }: { data: string; w61: number; w62: number }) {
  return (
    <FormularioUsina acao={salvarRecolhimentoDiaAction} rotuloBotao="Salvar recolhido do dia">
      <input type="hidden" name="data" value={data} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="field">
          <label htmlFor="barras_W61">Recolhido W61 (barras)</label>
          <input id="barras_W61" name="barras_W61" inputMode="numeric" defaultValue={w61 || ''} placeholder="0" className="h-11" />
        </div>
        <div className="field">
          <label htmlFor="barras_W62">Recolhido W62 (barras)</label>
          <input id="barras_W62" name="barras_W62" inputMode="numeric" defaultValue={w62 || ''} placeholder="0" className="h-11" />
        </div>
      </div>
      <p className="text-xs text-ink-muted">Em branco grava 0. Cada barra vale 10,5 m no informativo.</p>
    </FormularioUsina>
  );
}
