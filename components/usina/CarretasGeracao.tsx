'use client';

// Lista de carretas de um líder no dia. Cada carreta tem perfis (vários) e números.
// Vai para o servidor como JSON, no campo oculto "carretas".
import { useRef, useState } from 'react';

export interface CarretaEditavel {
  chave: number;
  perfis: string[];
  quantidade: string;
  carregamentoM: string;
  deixadaViaM: string;
}

export function CarretasGeracao({
  iniciais,
  opcoesPerfis,
}: {
  iniciais: Omit<CarretaEditavel, 'chave'>[];
  opcoesPerfis: readonly string[];
}) {
  const proximo = useRef(0);
  const novaChave = () => ++proximo.current;
  const vazia = (): CarretaEditavel => ({ chave: novaChave(), perfis: [], quantidade: '', carregamentoM: '', deixadaViaM: '' });
  const [lista, setLista] = useState<CarretaEditavel[]>(() =>
    iniciais.length > 0 ? iniciais.map((c) => ({ ...c, chave: novaChave() })) : [vazia()],
  );

  function atualizar(chave: number, campo: keyof Omit<CarretaEditavel, 'chave'>, valor: string | string[]) {
    setLista((atual) => atual.map((c) => (c.chave === chave ? { ...c, [campo]: valor } : c)));
  }

  function alternarPerfil(chave: number, perfil: string, marcado: boolean) {
    setLista((atual) =>
      atual.map((c) => {
        if (c.chave !== chave) return c;
        const perfis = marcado ? [...c.perfis, perfil] : c.perfis.filter((p) => p !== perfil);
        return { ...c, perfis };
      }),
    );
  }

  return (
    <div className="space-y-3">
      {lista.map((c, i) => (
        <div key={c.chave} className="space-y-3 rounded border border-line p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Carreta {i + 1}</span>
            {lista.length > 1 && (
              <button type="button" className="text-sm text-bad underline" onClick={() => setLista((atual) => atual.filter((x) => x.chave !== c.chave))}>
                Remover
              </button>
            )}
          </div>
          <fieldset className="space-y-1">
            <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Perfis desta carreta</legend>
            <div className="flex flex-wrap gap-2">
              {opcoesPerfis.map((p) => (
                <label key={p} className="inline-flex h-9 items-center gap-2 rounded border border-line px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={c.perfis.includes(p)}
                    onChange={(e) => alternarPerfil(c.chave, p, e.target.checked)}
                  />
                  {p}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="field">
              <label>Barras</label>
              <input inputMode="numeric" value={c.quantidade} onChange={(e) => atualizar(c.chave, 'quantidade', e.target.value)} className="h-11" />
            </div>
            <div className="field">
              <label>Carregamento (m)</label>
              <input inputMode="decimal" value={c.carregamentoM} onChange={(e) => atualizar(c.chave, 'carregamentoM', e.target.value)} className="h-11" />
            </div>
            <div className="field">
              <label>Deixada na via (m)</label>
              <input inputMode="decimal" value={c.deixadaViaM} onChange={(e) => atualizar(c.chave, 'deixadaViaM', e.target.value)} className="h-11" />
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-ghost h-11" onClick={() => setLista((atual) => [...atual, vazia()])}>
        Adicionar carreta
      </button>
      <input type="hidden" name="carretas" value={JSON.stringify(lista.map(({ chave: _, ...resto }) => resto))} />
    </div>
  );
}
