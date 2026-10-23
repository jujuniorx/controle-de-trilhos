'use client';

// Geração da semana: por líder, uma tabela de segunda a quinta com uma linha por carreta.
// Cada carreta tem perfis (vários), barras e metragens. Local, corte e observação são do dia.
// Tudo vai para o servidor num único campo oculto "dados", que o salvamento da semana lê.
import { useRef, useState, type ReactNode } from 'react';

export interface CarretaSemana {
  perfis: string[];
  quantidade: number | null;
  carregamentoM: number | null;
  deixadaViaM: number | null;
}

export interface LiderSemana {
  local: string | null;
  corteM: number | null;
  observacao: string | null;
  carretas: CarretaSemana[];
}

export interface DiaGeracaoSemana {
  data: string;
  rotulo: string;
  lideres: Record<string, LiderSemana>;
}

interface CarretaEditavel {
  chave: number;
  perfis: string[];
  quantidade: string;
  carregamentoM: string;
  deixadaViaM: string;
}

interface DiaEditavel {
  local: string;
  corte: string;
  observacao: string;
  carretas: CarretaEditavel[];
}

type Estado = Record<string, Record<string, DiaEditavel>>;

const texto = (v: number | null) => (v != null ? String(v).replace('.', ',') : '');

/** Soma os números de uma lista de campos de texto (aceita vírgula). */
function somar(valores: string[]): number {
  return valores.reduce((acc, v) => {
    const n = Number(v.trim().replace(',', '.'));
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function GeracaoSemana({
  dias,
  lideres,
  opcoesPerfis,
}: {
  dias: DiaGeracaoSemana[];
  lideres: readonly { valor: string; rotulo: string }[];
  opcoesPerfis: readonly string[];
}) {
  const proximo = useRef(0);
  const novaChave = () => ++proximo.current;

  const [estado, setEstado] = useState<Estado>(() => {
    const inicial: Estado = {};
    for (const dia of dias) {
      inicial[dia.data] = {};
      for (const l of lideres) {
        const s = dia.lideres[l.valor];
        inicial[dia.data][l.valor] = {
          local: s?.local ?? '',
          corte: texto(s?.corteM ?? null),
          observacao: s?.observacao ?? '',
          carretas: (s?.carretas ?? []).map((c) => ({
            chave: novaChave(),
            perfis: c.perfis,
            quantidade: texto(c.quantidade),
            carregamentoM: texto(c.carregamentoM),
            deixadaViaM: texto(c.deixadaViaM),
          })),
        };
      }
    }
    return inicial;
  });

  function alterarDia(data: string, lider: string, patch: Partial<Pick<DiaEditavel, 'local' | 'corte' | 'observacao'>>) {
    setEstado((atual) => ({ ...atual, [data]: { ...atual[data], [lider]: { ...atual[data][lider], ...patch } } }));
  }

  function alterarCarreta(data: string, lider: string, chave: number, mudanca: Partial<Omit<CarretaEditavel, 'chave'>>) {
    setEstado((atual) => {
      const d = atual[data][lider];
      const carretas = d.carretas.map((c) => (c.chave === chave ? { ...c, ...mudanca } : c));
      return { ...atual, [data]: { ...atual[data], [lider]: { ...d, carretas } } };
    });
  }

  function alternarPerfil(data: string, lider: string, carreta: CarretaEditavel, perfil: string, marcado: boolean) {
    const perfis = marcado ? [...carreta.perfis, perfil] : carreta.perfis.filter((p) => p !== perfil);
    alterarCarreta(data, lider, carreta.chave, { perfis });
  }

  function adicionarCarreta(data: string, lider: string) {
    const nova: CarretaEditavel = { chave: novaChave(), perfis: [], quantidade: '', carregamentoM: '', deixadaViaM: '' };
    setEstado((atual) => {
      const d = atual[data][lider];
      return { ...atual, [data]: { ...atual[data], [lider]: { ...d, carretas: [...d.carretas, nova] } } };
    });
  }

  function removerCarreta(data: string, lider: string, chave: number) {
    setEstado((atual) => {
      const d = atual[data][lider];
      return { ...atual, [data]: { ...atual[data], [lider]: { ...d, carretas: d.carretas.filter((c) => c.chave !== chave) } } };
    });
  }

  // Valor que vai no formulário: só texto e listas, sem as chaves internas da tela.
  const dados = Object.fromEntries(
    dias.map((d) => [
      d.data,
      Object.fromEntries(
        lideres.map((l) => {
          const x = estado[d.data][l.valor];
          return [
            l.valor,
            {
              local: x.local,
              corte: x.corte,
              observacao: x.observacao,
              carretas: x.carretas.map(({ perfis, quantidade, carregamentoM, deixadaViaM }) => ({ perfis, quantidade, carregamentoM, deixadaViaM })),
            },
          ];
        }),
      ),
    ]),
  );

  /** Célula do dia: rótulo, corte, local, observação e o total das carretas. */
  function celulaDia(d: DiaGeracaoSemana, lider: { valor: string; rotulo: string }, x: DiaEditavel, rowSpan: number): ReactNode {
    return (
      <td rowSpan={rowSpan} className="w-64 border-t border-line py-2 align-top">
        <p className="font-medium">{d.rotulo}</p>
        <div className="mt-2 space-y-2">
          <div className="field">
            <label>Corte (m)</label>
            <input inputMode="decimal" value={x.corte} onChange={(e) => alterarDia(d.data, lider.valor, { corte: e.target.value })} className="h-11 w-28" aria-label={`Corte ${lider.rotulo} ${d.rotulo}`} />
          </div>
          <div className="field">
            <label>Local</label>
            <input value={x.local} onChange={(e) => alterarDia(d.data, lider.valor, { local: e.target.value })} className="h-11 w-full" aria-label={`Local ${lider.rotulo} ${d.rotulo}`} />
          </div>
          <div className="field">
            <label>Observação</label>
            <textarea rows={2} value={x.observacao} onChange={(e) => alterarDia(d.data, lider.valor, { observacao: e.target.value })} className="w-full" aria-label={`Observação ${lider.rotulo} ${d.rotulo}`} />
          </div>
          <p className="text-xs text-ink-muted">
            Carregado {fmt(somar(x.carretas.map((c) => c.carregamentoM)))} m · Deixado {fmt(somar(x.carretas.map((c) => c.deixadaViaM)))} m · Barras {fmt(somar(x.carretas.map((c) => c.quantidade)))}
          </p>
        </div>
      </td>
    );
  }

  return (
    <div className="space-y-6">
      <input type="hidden" name="dados" value={JSON.stringify(dados)} />
      {lideres.map((l) => (
        <div key={l.valor} className="space-y-2">
          <p className="text-sm font-semibold">{l.rotulo}</p>
          <div className="tbl-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th className="py-2">Dia</th>
                  <th className="py-2">Carreta</th>
                  <th className="py-2">Perfis</th>
                  <th className="py-2 text-right">Barras</th>
                  <th className="py-2 text-right">Carregado (m)</th>
                  <th className="py-2 text-right">Deixado na via (m)</th>
                  <th className="py-2"><span className="sr-only">Remover</span></th>
                </tr>
              </thead>
              <tbody>
                {dias.flatMap((d) => {
                  const x = estado[d.data][l.valor];
                  const n = x.carretas.length;
                  const linhas: ReactNode[] = x.carretas.map((c, idx) => (
                    <tr key={c.chave} className="border-t border-line">
                      {idx === 0 && celulaDia(d, l, x, n + 1)}
                      <td className="py-2 align-top font-medium">Carreta {idx + 1}</td>
                      <td className="py-2 align-top">
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {opcoesPerfis.map((p) => (
                            <label key={p} className="inline-flex h-9 items-center gap-1 rounded border border-line px-2 text-xs">
                              <input type="checkbox" checked={c.perfis.includes(p)} onChange={(e) => alternarPerfil(d.data, l.valor, c, p, e.target.checked)} />
                              {p}
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 align-top">
                        <div className="field">
                          <label>Barras</label>
                          <input inputMode="numeric" value={c.quantidade} onChange={(e) => alterarCarreta(d.data, l.valor, c.chave, { quantidade: e.target.value })} className="h-11 w-20" aria-label={`Barras ${l.rotulo} ${d.rotulo} carreta ${idx + 1}`} />
                        </div>
                      </td>
                      <td className="py-2 align-top">
                        <div className="field">
                          <label>Carregado (m)</label>
                          <input inputMode="decimal" value={c.carregamentoM} onChange={(e) => alterarCarreta(d.data, l.valor, c.chave, { carregamentoM: e.target.value })} className="h-11 w-28" aria-label={`Carregado ${l.rotulo} ${d.rotulo} carreta ${idx + 1}`} />
                        </div>
                      </td>
                      <td className="py-2 align-top">
                        <div className="field">
                          <label>Deixado na via (m)</label>
                          <input inputMode="decimal" value={c.deixadaViaM} onChange={(e) => alterarCarreta(d.data, l.valor, c.chave, { deixadaViaM: e.target.value })} className="h-11 w-28" aria-label={`Deixado ${l.rotulo} ${d.rotulo} carreta ${idx + 1}`} />
                        </div>
                      </td>
                      <td className="py-2 text-right align-top">
                        <button type="button" className="h-11 text-sm text-bad underline" onClick={() => removerCarreta(d.data, l.valor, c.chave)}>Remover</button>
                      </td>
                    </tr>
                  ));
                  // Linha final do dia: adicionar carreta. Sem carretas, ela também abre a célula do dia.
                  const adicionar = (
                    <tr key={`${d.data}-add`} className={n === 0 ? 'border-t border-line' : undefined}>
                      {n === 0 && celulaDia(d, l, x, 1)}
                      <td colSpan={6} className="py-2">
                        <button type="button" className="btn btn-ghost h-11" onClick={() => adicionarCarreta(d.data, l.valor)}>
                          Adicionar carreta
                        </button>
                      </td>
                    </tr>
                  );
                  return n === 0 ? [adicionar] : [...linhas, adicionar];
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
