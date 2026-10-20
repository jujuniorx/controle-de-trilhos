'use client';

import { useState, type ReactNode } from 'react';
import {
  ITENS_ESCALA,
  GRUPOS_ESCALA,
  STATUS_ESCALA,
  TIPOS_CICLO,
  ESTILO_STATUS,
  aplicarCiclos,
  type EscalaSemanaValor,
  type DiaEscala,
  type ConfigCiclo,
} from '@/lib/usina/escala';



const estiloDe = (status: string) => ESTILO_STATUS[status] ?? ESTILO_STATUS['-'];

const EH_MMD = (local: string) => local.trim().toUpperCase() === 'MMD';

/**
 * Escala da semana no modo pincel: escolhe o status (e o local, se preenchido) na barra de cima
 * e toca nos dias para pintar. Cada dia mostra o status na cor e o local embaixo.
 */
export function EscalaGrade({
  valor,
  dias,
  semana,
}: {
  valor: EscalaSemanaValor;
  dias: { nome: string; data: string }[];
  semana: string;
}) {
  const [plantao, setPlantao] = useState<string[]>(valor.plantao);
  const [linhas, setLinhas] = useState<Record<string, DiaEscala[]>>(valor.linhas);
  const [config, setConfig] = useState<Record<string, ConfigCiclo>>(valor.config);
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

  function preencherCiclos() {
    setLinhas((atual) => aplicarCiclos(atual, config, semana));
  }

  function mudarConfig(id: string, campo: keyof ConfigCiclo, v: string) {
    setConfig((atual) => ({ ...atual, [id]: { ...atual[id], [campo]: v } as ConfigCiclo }));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-[var(--ln2)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">Ciclo automático</p>
          <button type="button" onClick={preencherCiclos} className="btn btn-ghost h-10 px-4 text-sm">
            Preencher a semana pelo ciclo
          </button>
        </div>
        <p className="text-xs text-ink-muted">
          Ajuste o tipo e a data de início de cada pessoa na coluna "Quem". Depois clique no botão para preencher a semana. Você ainda pode editar qualquer dia pelo pincel abaixo. Itens em "Manual" não são preenchidos.
        </p>
        <p className="text-sm font-semibold">Pincel manual</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status do pincel">
          {STATUS_ESCALA.map((s) => {
            const ativo = pincel === s.valor;
            const est = estiloDe(s.valor);
            return (
              <button
                key={s.valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setPincel(s.valor)}
                className="h-10 min-w-[64px] rounded-lg px-3 text-sm font-semibold"
                style={{
                  background: est.fundo,
                  color: est.texto,
                  opacity: ativo ? 1 : 0.5,
                  boxShadow: ativo ? '0 0 0 2px var(--t1)' : 'none',
                  border: '1px solid var(--ln2)',
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
              {plantao.map((p, i) =>
                i < 5 ? (
                  <td key={i} className="p-0.5">
                    <div className="flex h-9 w-full items-center justify-center text-xs text-ink-muted" aria-hidden="true">
                      -
                    </div>
                  </td>
                ) : (
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
                ),
              )}
            </tr>

            {GRUPOS_ESCALA.map((grupo) => (
              <GrupoLinhas key={grupo} grupo={grupo}>
                {ITENS_ESCALA.filter((it) => it.grupo === grupo).map((item) => (
                  <ItemLinhas
                    key={item.id}
                    rotulo={item.rotulo}
                    cfgTipo={`cfg_tipo_${item.id}`}
                    cfgInicio={`cfg_inicio_${item.id}`}
                    tipo={config[item.id]?.tipo ?? 'manual'}
                    inicio={config[item.id]?.inicio ?? ''}
                    onTipo={(v) => mudarConfig(item.id, 'tipo', v)}
                    onInicio={(v) => mudarConfig(item.id, 'inicio', v)}
                    dias={linhas[item.id]}
                    rotulosDias={dias}
                    item={item.id}
                    onPintar={(i) => pintar(item.id, i)}
                  />
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

function ItemLinhas({
  rotulo,
  cfgTipo,
  cfgInicio,
  tipo,
  inicio,
  onTipo,
  onInicio,
  dias: celulas,
  rotulosDias,
  item,
  onPintar,
}: {
  rotulo: string;
  cfgTipo: string;
  cfgInicio: string;
  tipo: string;
  inicio: string;
  onTipo: (v: string) => void;
  onInicio: (v: string) => void;
  dias: DiaEscala[];
  rotulosDias: { nome: string; data: string }[];
  item: string;
  onPintar: (i: number) => void;
}) {
  return (
    <>
      <tr>
        <th
          scope="rowgroup"
          className="sticky left-0 z-10 w-[120px] bg-[var(--g2)] px-2 py-1 text-left align-top"
        >
          <span className="block whitespace-nowrap text-base font-bold">{rotulo}</span>
          <select
            aria-label={`Tipo de escala de ${rotulo}`}
            name={cfgTipo}
            value={tipo}
            onChange={(e) => onTipo(e.target.value)}
            className="mt-1 h-8 w-full text-xs"
          >
            {TIPOS_CICLO.map((t) => (
              <option key={t.valor} value={t.valor}>{t.rotulo}</option>
            ))}
          </select>
          <input type="hidden" name={cfgInicio} value={inicio} />
        </th>
        {celulas.map((c, i) => {
          const est = estiloDe(c.status);
          return (
            <td key={i} className="p-0 align-middle">
              <input type="hidden" name={`st_${item}_${i}`} value={c.status} />
              <input type="hidden" name={`lc_${item}_${i}`} value={c.local} />
              <button
                type="button"
                onClick={() => onPintar(i)}
                aria-label={`${rotulo} ${rotulosDias[i].nome}: ${c.status}`}
                className="h-9 w-full text-sm font-bold"
                style={{ background: est.fundo, color: est.texto, border: '1px solid var(--ln2)' }}
              >
                {c.status === '-' ? '-' : STATUS_ESCALA.find((s) => s.valor === c.status)?.rotulo ?? c.status}
              </button>
            </td>
          );
        })}
      </tr>
      <tr>
        <th scope="row" className="sticky left-0 z-10 bg-[var(--g2)] px-2 pb-1 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
          Local
        </th>
        {celulas.map((c, i) => (
          <td key={i} className="p-0">
            <div className="h-7 truncate px-1 text-center text-xs leading-7 text-ink-muted" title={c.local}>
              {c.local || ''}
            </div>
          </td>
        ))}
      </tr>
    </>
  );
}
