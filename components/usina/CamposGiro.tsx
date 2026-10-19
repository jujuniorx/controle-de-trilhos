'use client';

// Campos de um giro de trilheiro. Se o trilheiro já tem ciclo em aberto, as datas
// de B.O., chegada e partida aparecem travadas (já foram preenchidas uma vez) e os
// perfis, TLS e local vêm preenchidos. O saldo (carregados - descarregados) atualiza na hora.
import { useState } from 'react';

export interface CicloAberto {
  boEm: string | null;
  chegadaUsinaEm: string | null;
  partidaEm: string | null;
  perfis: string[];
  carregados: number;
  descarregados: number;
  local: string | null;
  observacao: string | null;
}

export function CamposGiro({ ciclo, opcoesPerfis }: { ciclo: CicloAberto | null; opcoesPerfis: { valor: string; rotulo: string }[] }) {
  const [carregados, setCarregados] = useState(ciclo ? String(ciclo.carregados) : '');
  const [descarregados, setDescarregados] = useState(ciclo ? String(ciclo.descarregados) : '');
  const saldo = (Number(carregados) || 0) - (Number(descarregados) || 0);
  const travada = (valor: string | null | undefined) => Boolean(ciclo && valor);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="field">
          <label>Dia do B.O.</label>
          <input name="boEm" type="date" defaultValue={ciclo?.boEm ?? ''} readOnly={travada(ciclo?.boEm)} className={`h-11 ${travada(ciclo?.boEm) ? 'opacity-70' : ''}`} />
        </div>
        <div className="field">
          <label>Chegada na usina</label>
          <input name="chegadaUsinaEm" type="date" defaultValue={ciclo?.chegadaUsinaEm ?? ''} readOnly={travada(ciclo?.chegadaUsinaEm)} className={`h-11 ${travada(ciclo?.chegadaUsinaEm) ? 'opacity-70' : ''}`} />
        </div>
        <div className="field">
          <label>Dia da partida</label>
          <input name="partidaEm" type="date" defaultValue={ciclo?.partidaEm ?? ''} readOnly={travada(ciclo?.partidaEm)} className={`h-11 ${travada(ciclo?.partidaEm) ? 'opacity-70' : ''}`} />
        </div>
        <div className="field">
          <label>Retorno (finaliza o ciclo)</label>
          <input name="retornoEm" type="date" className="h-11" />
        </div>
      </div>

      <fieldset className="space-y-1">
        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Perfis</legend>
        <div className="flex flex-wrap gap-2">
          {opcoesPerfis.map((p) => (
            <label key={p.valor} className="inline-flex h-9 items-center gap-2 rounded border border-line px-3 text-sm">
              <input type="checkbox" name="perfis" value={p.valor} defaultChecked={ciclo?.perfis.includes(p.valor) ?? false} />
              {p.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
        <div className="field">
          <label>TLS carregados</label>
          <input name="carregados" inputMode="numeric" value={carregados} onChange={(e) => setCarregados(e.target.value)} className="h-11" />
        </div>
        <div className="field">
          <label>TLS descarregados</label>
          <input name="descarregados" inputMode="numeric" value={descarregados} onChange={(e) => setDescarregados(e.target.value)} className="h-11" />
        </div>
        <div className="field">
          <label>Saldo a descarregar</label>
          <p className={`flex h-11 items-center font-mono text-lg font-semibold ${saldo < 0 ? 'text-bad' : 'text-ink'}`}>{saldo}</p>
        </div>
        <div className="field">
          <label>Local</label>
          <input name="local" defaultValue={ciclo?.local ?? ''} className="h-11" />
        </div>
      </div>
      <div className="field">
        <label>Observação</label>
        <input name="observacao" defaultValue={ciclo?.observacao ?? ''} className="h-11" />
      </div>
    </div>
  );
}
