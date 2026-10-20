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

/** Grade da escala semanal: pessoas e caminhões nas linhas, dias nas colunas. Edição direta, sem planilha. */
export function EscalaGrade({ valor, dias }: { valor: EscalaSemanaValor; dias: { nome: string; data: string }[] }) {
  const [plantao, setPlantao] = useState<string[]>(valor.plantao);
  const [linhas, setLinhas] = useState<Record<string, DiaEscala[]>>(valor.linhas);

  function mudar(id: string, i: number, campo: keyof DiaEscala, v: string) {
    setLinhas((atual) => {
      const dias = atual[id].map((c, k) => (k === i ? { ...c, [campo]: v } : c));
      return { ...atual, [id]: dias };
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span><b className="text-ink">OK</b> trabalhou</span>
        <span><b className="text-ink">FOLGA</b></span>
        <span><b className="text-ink">DESL.</b> deslocamento</span>
        <span><b className="text-ink">MAN.</b> manutenção</span>
        <span><b className="text-ink">TITAN / PRUMO</b> empresas</span>
        <span><b className="text-ink">-</b> sem escala</span>
        <span><b className="text-ink">MMD</b> = empresa de manutenção (destacada)</span>
      </div>

      <div className="-mx-1 overflow-x-auto pb-2">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-sm">
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
            <tr className="bg-[var(--g3)]">
              <th scope="row" className="sticky left-0 z-10 bg-[var(--g3)] px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider">
                Plantão (fim de semana)
              </th>
              {plantao.map((p, i) => (
                <td key={i} className="p-1">
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
                      const mmd = EH_MMD(c.local);
                      return (
                        <td
                          key={i}
                          className="border-l border-[var(--ln)] p-1 align-top"
                          style={mmd ? { background: 'color-mix(in srgb, var(--b3) 22%, transparent)' } : undefined}
                        >
                          <select
                            aria-label={`${item.rotulo} ${dias[i].nome} status`}
                            name={`st_${item.id}_${i}`}
                            value={c.status}
                            onChange={(e) => mudar(item.id, i, 'status', e.target.value)}
                            className="mb-1 h-9 w-full text-xs font-semibold"
                            style={{ color: COR_STATUS[c.status] ?? 'var(--t1)' }}
                          >
                            {STATUS_ESCALA.map((s) => (
                              <option key={s.valor} value={s.valor}>{s.rotulo}</option>
                            ))}
                          </select>
                          <input
                            aria-label={`${item.rotulo} ${dias[i].nome} onde estava`}
                            name={`lc_${item.id}_${i}`}
                            value={c.local}
                            maxLength={40}
                            placeholder="Onde"
                            onChange={(e) => mudar(item.id, i, 'local', e.target.value)}
                            className="h-9 w-full text-center text-xs"
                          />
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
        <th colSpan={8} className="px-2 pb-1 pt-4 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
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
      <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-[var(--g2)] px-2 py-1 text-left font-semibold">
        {rotulo}
      </th>
      {children}
    </tr>
  );
}
