'use client';

import { useState, type ReactNode } from 'react';
import {
  ITENS_ESCALA,
  GRUPOS_ESCALA,
  STATUS_ESCALA,
  TIPOS_CICLO,
  ESTILO_STATUS,
  ITENS_SEM_LOCAL,
  aplicarCiclos,
  type EscalaSemanaValor,
  type DiaEscala,
  type ConfigCiclo,
} from '@/lib/usina/escala';
import { FormularioUsina, type ResultadoFormUsina } from '@/components/usina/FormularioUsina';

const estiloDe = (status: string) => ESTILO_STATUS[status] ?? ESTILO_STATUS['-'];
const EH_MMD = (local: string) => local.trim().toUpperCase() === 'MMD';

/**
 * Escala da semana. Abre em modo de leitura, igual a planilha.
 * "Editar escala" libera o pincel, o local e o plantao; "Salvar" grava a semana.
 */
export function EscalaGrade({
  valor,
  dias,
  semana,
  acao,
}: {
  valor: EscalaSemanaValor;
  dias: { nome: string; data: string }[];
  semana: string;
  acao: (estadoAnterior: ResultadoFormUsina | undefined, formData: FormData) => Promise<ResultadoFormUsina>;
}) {
  const [editando, setEditando] = useState(false);
  const [plantao, setPlantao] = useState<string[]>(valor.plantao);
  const [linhas, setLinhas] = useState<Record<string, DiaEscala[]>>(valor.linhas);
  const [config, setConfig] = useState<Record<string, ConfigCiclo>>(valor.config);
  const [pincel, setPincel] = useState<string>('OK');
  const [local, setLocal] = useState<string>('');

  function pintar(id: string, i: number) {
    if (!editando) return;
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

  /** Muda o tipo ou a data de inicio; a linha da pessoa e refeita pelo ciclo novo. */
  function mudarCiclo(id: string, novo: ConfigCiclo) {
    setConfig((atual) => ({ ...atual, [id]: novo }));
    setLinhas((atual) => aplicarCiclos(atual, { [id]: novo }, semana));
  }

  function preencherCiclos() {
    setLinhas((atual) => aplicarCiclos(atual, config, semana));
  }

  function cancelar() {
    setPlantao(valor.plantao);
    setLinhas(valor.linhas);
    setLocal('');
    setEditando(false);
  }

  const grade = (
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
                  <div className="flex h-9 w-full items-center justify-center text-xs text-ink-muted" aria-hidden="true">-</div>
                </td>
              ) : (
                <td key={i} className="p-0.5">
                  {editando ? (
                    <input
                      aria-label={`Plantão ${dias[i].nome}`}
                      name={`plantao_${i}`}
                      value={p}
                      maxLength={40}
                      onChange={(e) => setPlantao((a) => a.map((x, k) => (k === i ? e.target.value : x)))}
                      placeholder="Nome"
                      className="h-9 w-full text-center text-sm"
                    />
                  ) : (
                    <>
                      <input type="hidden" name={`plantao_${i}`} value={p} />
                      <div className="flex h-9 w-full items-center justify-center text-sm font-semibold">{p || '-'}</div>
                    </>
                  )}
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
                  onCiclo={(novo) => mudarCiclo(item.id, novo)}
                  dias={linhas[item.id]}
                  rotulosDias={dias}
                  item={item.id}
                  editando={editando}
                  onPintar={(i) => pintar(item.id, i)}
                />
              ))}
            </GrupoLinhas>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!editando) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">Escala automática. Use "Editar escala" só se precisar mudar algum dia.</p>
          <button type="button" onClick={() => setEditando(true)} className="btn btn-ghost h-10 px-4 text-sm">
            Editar escala
          </button>
        </div>
        {grade}
      </div>
    );
  }

  return (
    <FormularioUsina acao={acao} rotuloBotao="Salvar escala">
      <input type="hidden" name="semana" value={semana} />
      <div className="space-y-4">
        <div className="space-y-3 rounded-xl border border-[var(--ln2)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">Editar escala</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={preencherCiclos} className="btn btn-ghost h-10 px-4 text-sm">
                Preencher a semana pelo ciclo
              </button>
              <button type="button" onClick={cancelar} className="btn btn-ghost h-10 px-4 text-sm">
                Cancelar
              </button>
            </div>
          </div>
          <p className="text-sm font-semibold">Pincel</p>
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
            <label htmlFor="local-pincel">Local (opcional)</label>
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
        {grade}
      </div>
    </FormularioUsina>
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
  onCiclo,
  dias: celulas,
  rotulosDias,
  item,
  editando,
  onPintar,
}: {
  rotulo: string;
  cfgTipo: string;
  cfgInicio: string;
  tipo: string;
  inicio: string;
  onCiclo: (novo: ConfigCiclo) => void;
  dias: DiaEscala[];
  rotulosDias: { nome: string; data: string }[];
  item: string;
  editando: boolean;
  onPintar: (i: number) => void;
}) {
  return (
    <>
      <tr>
        <th scope="rowgroup" className="sticky left-0 z-10 w-[120px] bg-[var(--g2)] px-2 py-1 text-left align-top">
          <span className="block whitespace-nowrap text-base font-bold">{rotulo}</span>
          {editando ? (
            <div className="mt-1 space-y-1">
              <select
                aria-label={`Tipo de escala de ${rotulo}`}
                name={cfgTipo}
                value={tipo}
                onChange={(e) => onCiclo({ tipo: e.target.value as ConfigCiclo['tipo'], inicio })}
                className="h-8 w-full text-xs"
              >
                {TIPOS_CICLO.map((t) => (
                  <option key={t.valor} value={t.valor}>{t.rotulo}</option>
                ))}
              </select>
              {(tipo === '11x3' || tipo === '10x4') && (
                <input
                  type="date"
                  aria-label={`Primeiro dia de trabalho de ${rotulo}`}
                  name={cfgInicio}
                  value={inicio}
                  onChange={(e) => onCiclo({ tipo: tipo as ConfigCiclo['tipo'], inicio: e.target.value })}
                  className="h-8 w-full text-xs"
                />
              )}
              {!(tipo === '11x3' || tipo === '10x4') && <input type="hidden" name={cfgInicio} value={inicio} />}
            </div>
          ) : (
            <>
              <span className="block text-[11px] text-ink-muted">{TIPOS_CICLO.find((t) => t.valor === tipo)?.rotulo ?? ''}</span>
              <input type="hidden" name={cfgTipo} value={tipo} />
              <input type="hidden" name={cfgInicio} value={inicio} />
            </>
          )}
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
                disabled={!editando}
                aria-label={`${rotulo} ${rotulosDias[i].nome}: ${c.status}`}
                className="h-9 w-full text-sm font-bold disabled:cursor-default"
                style={{ background: est.fundo, color: est.texto, border: '1px solid var(--ln2)' }}
              >
                {c.status === '-' ? '-' : STATUS_ESCALA.find((s) => s.valor === c.status)?.rotulo ?? c.status}
              </button>
            </td>
          );
        })}
      </tr>
      {!ITENS_SEM_LOCAL.has(item) && (
      <tr>
        <th scope="row" className="sticky left-0 z-10 bg-[var(--g2)] px-2 pb-1 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
          Local
        </th>
        {celulas.map((c, i) => (
          <td key={i} className="p-0">
            <div
              className="h-7 truncate px-1 text-center text-xs leading-7 text-ink-muted"
              title={c.local}
              style={EH_MMD(c.local) ? { color: 'var(--b4)', fontWeight: 700 } : undefined}
            >
              {c.local || ''}
            </div>
          </td>
        ))}
      </tr>
      )}
    </>
  );
}
