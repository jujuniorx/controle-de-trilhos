'use client';

import { useState, type ReactNode } from 'react';
import { ITENS_ESCALA, GRUPOS_ESCALA, STATUS_ESCALA, type EscalaSemanaValor, type DiaEscala } from '@/lib/usina/escala';

const COR_STATUS: Record<string, string> = {
  OK: 'var(--ok)',
  FOLGA: 'var(--t3)',
  'DESL.': '#d97706',
  'MAN.': '#d97706',
  TITAN: 'var(--b4)',
  PRUMO: 'var(--b4)',
  EXTRA: '#7c3aed',
  '-': 'var(--t3)',
};

const EH_MMD = (local: string) => local.trim().toUpperCase() === 'MMD';

/**
 * Escala da semana no modo pincel: escolhe o status (e o local, se preenchido) na barra de cima
 * e toca nos dias para pintar. Cada dia mostra o status na cor e o local embaixo.
 */
export function EscalaGrade({ valor, dias }: { valor: EscalaSemanaValor; dias: { nome: string; data: string }[] }) {
  const [plantao, setPlantao] = useState<string[]>(valor.plantao);
  const [linhas, setLinhas] = useState<Record<string, DiaEscala[]>>(valor.linhas);
  const [pincel, setPincel] = useState<string>('OK');
  const [local, setLocal] = useState<string>('');

  function pintar(id: string, i: number) {
    setLinhas((atual) => ({
      ...atual,
      [id]: atual[id].map((c, k) => {
        if (k !== i) return c;
        if (pincel === '-') return { status: '-', local: '' };
        const novoLocal = local.trim() !== '' ? local.trim().slice(0, 40) : c.local;
        return { status: pincel, local: novoLocal };
      }),
    }));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-[var(--ln2)] p-3">
        <p className="text-sm font-semibold">1. Escolha o status e toque nos dias</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status do pincel">
          {STATUS_ESCALA.map((s) => {
            const ativo = pincel === s.valor;
            const cor = COR_STATUS[s.valor] ?? 'var(--t1)';
            return (
              <button
                key={s.valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setPincel(s.valor)}
                className="h-10 min-w-[64px] rounded-lg px-3 text-sm font-semibold"
                style={{
                  color: ativo ? '#fff' : cor,
                  background: ativo ? cor : `color-mix(in srgb, ${cor} 14%, transparent)`,
                  boxShadow: ativo ? 'none' : `inset 0 0 0 1px ${cor}`,
                }}
              >
                {s.rotulo}
              </button>
            );
          })}
        </div>
        <div className="field max-w-sm">
          <label htmlFor="local-pincel">2. Local (opcional)</label>
          <input
            id="local-pincel"
            value={local}
            maxLength={40}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Ex.: MMD, Pátio, Oficina"
            className="h-10"
          />
          <span className="hint">Se preencher, os dias pintados recebem esse local.</span>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto pb-2">
        <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--g2)] px-2 py-2 text-left font-semibold">Quem</th>
              {dias.map((d) => (
                <th key={d.nome} className="px-1 py-2 text-center font-semibold">
                  <span className="block">{d.nome}</span>
                  <span className="block text-xs font-normal text-ink-muted">{d.data}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="sticky left-0 z-10 bg-[var(--g3)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                Plantão
              </th>
              {plantao.map((p, i) => (
                <td key={i} className="p-0.5">
                  <input
                    aria-label={`Plantão ${dias[i].nome}`}
                    name={`plantao_${i}`}
                    value={p}
                    maxLength={40}
                    onChange={(e) => setPlantao((a) => a.map((x, k) => (k === i ? e.target.value : x)))}
                    placeholder="Nome"
                    className="h-9 w-full text-center text-sm"
                  />
                </td>
              ))}
            </tr>

            {GRUPOS_ESCALA.map((grupo) => (
              <GrupoLinhas key={grupo} grupo={grupo}>
                {ITENS_ESCALA.filter((it) => it.grupo === grupo).map((item) => (
                  <Linha key={item.id} rotulo={item.rotulo}>
                    {linhas[item.id].map((c, i) => {
                      const cor = COR_STATUS[c.status] ?? 'var(--t1)';
                      const mmd = EH_MMD(c.local);
                      return (
                        <td key={i} className="p-0.5">
                          <input type="hidden" name={`st_${item.id}_${i}`} value={c.status} />
                          <input type="hidden" name={`lc_${item.id}_${i}`} value={c.local} />
                          <button
                            type="button"
                            onClick={() => pintar(item.id, i)}
                            aria-label={`${item.rotulo} ${dias[i].nome}: ${c.status}${c.local ? ', ' + c.local : ''}`}
                            className="flex min-h-[64px] w-full flex-col items-center justify-center rounded-lg px-1 py-2"
                            style={{
                              background: c.status === '-' ? 'transparent' : `color-mix(in srgb, ${cor} 18%, transparent)`,
                              boxShadow: mmd ? 'inset 0 0 0 2px var(--b3)' : 'inset 0 0 0 1px var(--ln2)',
                            }}
                          >
                            <span className="text-sm font-semibold" style={{ color: c.status === '-' ? 'var(--t3)' : cor }}>
                              {c.status === '-' ? '·' : STATUS_ESCALA.find((s) => s.valor === c.status)?.rotulo ?? c.status}
                            </span>
                            {c.local && <span className="mt-0.5 max-w-full truncate text-xs text-ink-muted">{c.local}</span>}
                          </button>
                        </td>
                      );
                    })}
                  </Linha>
                ))}
              </GrupoLinhas>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GrupoLinhas({ grupo, children }: { grupo: string; children: ReactNode }) {
  return (
    <>
      <tr>
        <th colSpan={8} className="px-2 pb-0 pt-5 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {grupo}
        </th>
      </tr>
      {children}
    </>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <tr>
      <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-[var(--g2)] px-3 py-1 text-left text-base font-semibold">
        {rotulo}
      </th>
      {children}
    </tr>
  );
}
