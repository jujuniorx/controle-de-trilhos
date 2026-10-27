import { Fragment, type ReactNode } from 'react';
import { GraficoBarras } from '@/components/usina/GraficoBarras';
import type { LinhaRelatorio, SetorRelatorio, TrilheirosRelatorio, EquipeGeracaoRelatorio, SerraRelatorio, MedidaSerra } from '@/lib/services/onePageUsina';
import { fmtMetros } from '@/lib/format';
import type { Coluna } from '@/lib/usina/periodo';

const TODAS: Coluna[] = ['dia', 'semana', 'mes'];

/** Um setor: cabeçalho colorido, tabela Dia | Semana e o gráfico de segunda a domingo. */
/** Valor com partes separadas por ' / ', cada parte na sua cor (ex.: W61 e W62 com cores diferentes). */
function ValorComCores({ valor, cores, corPadrao }: { valor: string; cores?: string[]; corPadrao: string }) {
  const partes = valor.split(' / ');
  if (!cores || partes.length !== cores.length) return <span style={{ color: corPadrao }}>{valor}</span>;
  return (
    <>
      {partes.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="text-slate-400"> / </span>}
          <span style={{ color: cores[i] }}>{p}</span>
        </span>
      ))}
    </>
  );
}

/** Tabela da serra: W61 e W62 nas linhas, com Dia, Semana e Mês em barras e metros, cada composição na sua cor. */
function TabelaSerra({ serra, colunas = TODAS }: { serra: SerraRelatorio; colunas?: Coluna[] }) {
  const grupos = [
    { rotulo: 'Dia', chave: 'dia' as const },
    { rotulo: 'Semana', chave: 'semana' as const },
    { rotulo: 'No mês', chave: 'mes' as const },
  ].filter((g) => colunas.includes(g.chave));
  const celula = (m: MedidaSerra) => (
    <>
      <td className="py-1 text-right font-semibold tabular-nums">{m.barras}</td>
      <td className="py-1 text-right font-semibold tabular-nums">{fmtMetros(m.metros)}</td>
    </>
  );
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="text-[11px] uppercase tracking-wide text-slate-500">
          <th className="pb-1 text-left font-semibold"> </th>
          {grupos.map((g) => (
            <th key={g.rotulo} colSpan={2} className="pb-1 text-center font-semibold">{g.rotulo}</th>
          ))}
        </tr>
        <tr className="text-[10px] uppercase tracking-wide text-slate-500">
          <th className="pb-1 text-left font-semibold"> </th>
          {grupos.map((g) => (
            <Fragment key={g.rotulo}>
              <th className="pb-1 text-right font-semibold">Barras</th>
              <th className="pb-1 text-right font-semibold">Metros est.</th>
            </Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {serra.linhas.map((l) => (
          <tr key={l.ativo} className="border-t border-slate-100">
            <td className="py-1 font-bold" style={{ color: l.cor }}>{l.ativo}</td>
            {grupos.map((g) => <Fragment key={g.rotulo}>{celula(l[g.chave])}</Fragment>)}
          </tr>
        ))}
        <tr className="border-t-2 border-slate-200">
          <td className="py-1 font-bold text-slate-900">Total</td>
          {grupos.map((g) => <Fragment key={g.rotulo}>{celula(serra.total[g.chave])}</Fragment>)}
        </tr>
      </tbody>
    </table>
  );
}

export function Setor({ s, rotulosDias, largo = false, mensal = false, colunas = TODAS, rodape, diaDestaque }: { s: SetorRelatorio; rotulosDias: string[]; largo?: boolean; mensal?: boolean; colunas?: Coluna[]; rodape?: ReactNode; /** Índice do dia escolhido (0 = segunda). Quando existe, o gráfico destaca esse dia e deixa o resto da semana em cinza. */ diaDestaque?: number }) {
  const mostraDia = !mensal && colunas.includes('dia');
  const mostraSem = !mensal && colunas.includes('semana');
  const mostraMes = colunas.includes('mes');
  if (s.serra) {
    return (
      <section className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white break-inside-avoid">
        <header className="px-4 py-2.5 text-white" style={{ background: s.cor }}>
          <span className="text-sm font-bold">{s.titulo}</span>
        </header>
        <div className={largo ? 'grid items-start gap-6 p-4 lg:grid-cols-2' : 'space-y-3 p-4'}>
          <TabelaSerra serra={s.serra} colunas={mensal ? ['mes'] : colunas} />
          {s.grafico && (
            <GraficoBarras
              titulo={s.grafico.titulo}
              rotulos={rotulosDias}
              series={s.grafico.series.map((x) => ({ nome: x.nome, cor: x.cor, valores: x.valores }))}
              destaque={mensal ? undefined : diaDestaque}
            />
          )}
        </div>
        {rodape && <div className="mt-auto border-t border-slate-100 px-4 py-3">{rodape}</div>}
      </section>
    );
  }
  const tabela = (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="text-[11px] uppercase tracking-wide text-slate-500">
          <th className="pb-1 text-left font-semibold"> </th>
          {mostraDia && <th className="pb-1 text-right font-semibold">Dia</th>}
          {mostraSem && <th className="pb-1 text-right font-semibold">Semana</th>}
          {mostraMes && <th className="pb-1 text-right font-semibold">No mês</th>}
        </tr>
      </thead>
      <tbody>
        {s.linhas.map((l) => (
          <Fragment key={l.rotulo}>
            {l.secao && (
              <tr>
                <td colSpan={1 + (mostraDia ? 1 : 0) + (mostraSem ? 1 : 0) + (mostraMes ? 1 : 0)} className="pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{l.secao}</td>
              </tr>
            )}
          <tr className="border-t border-slate-100">
            <td className="py-1 text-slate-700">{l.rotulo}</td>
            {mostraDia && <td className="py-1 text-right font-medium tabular-nums text-slate-900"><ValorComCores valor={l.dia} cores={l.cores} corPadrao="#0f172a" /></td>}
            {mostraSem && <td className="py-1 text-right font-medium tabular-nums text-slate-900"><ValorComCores valor={l.semana} cores={l.cores} corPadrao="#0f172a" /></td>}
            {mostraMes && <td className="py-1 text-right font-bold tabular-nums"><ValorComCores valor={l.mes} cores={l.cores} corPadrao={s.cor} /></td>}
          </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
  // Gráfico diário do setor; sem gráfico, mostra a grade de números quando existir.
  const grafico = mensal ? null : s.grafico ? (
    <div>
      <GraficoBarras
        titulo={s.grafico.titulo}
        rotulos={rotulosDias}
        series={s.grafico.series.map((x) => ({ nome: x.nome, cor: x.cor, valores: x.valores }))}
        destaque={diaDestaque}
      />
    </div>
  ) : s.grade ? (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-slate-500">
          <th className="pb-1 text-left font-semibold"> </th>
          {s.grade.colunas.map((c) => (
            <th key={c} className="pb-1 text-right font-semibold">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {s.grade.linhas.map((l) => (
          <tr key={l.rotulo} className="border-t border-slate-100">
            <td className="py-1 font-semibold text-slate-700">{l.rotulo}</td>
            {l.valores.map((v, i) => (
              <td key={i} className="py-1 text-right tabular-nums" style={{ color: s.cor }}>{v}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ) : (

    <p className="py-6 text-center text-xs text-slate-400">Sem gráfico diário para este setor.</p>
  );
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white break-inside-avoid">
      <header className="px-4 py-2.5 text-white" style={{ background: s.cor }}>
        <span className="text-sm font-bold">{s.titulo}</span>
      </header>
      {largo ? (
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="shrink-0">{tabela}</div>
          <div className="shrink-0 border-t border-slate-100 pt-2 md:border-l md:border-t-0 md:pl-4 md:pt-0">{grafico}</div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="shrink-0">{tabela}</div>
          <div className="mt-auto shrink-0 border-t border-slate-100 pt-2">{grafico}</div>
        </div>
      )}
      {rodape && <div className="mt-auto border-t border-slate-100 px-4 py-3">{rodape}</div>}
    </section>
  );
}

/** Estoque de TLS no dia, em faixa própria abaixo dos setores (mesmo formato do PDF). */
export function EstoqueTlsBloco({ linhas, cor }: { linhas: LinhaRelatorio[]; cor: string }) {
  const itens = linhas.filter((l) => !l.secao);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white break-inside-avoid">
      <header className="px-4 py-2.5 text-white" style={{ background: cor }}>
        <span className="text-sm font-bold">Estoque de TLS (no dia)</span>
      </header>
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-5">
        {itens.map((l) => (
          <div key={l.rotulo} className="rounded-lg border border-slate-200 p-3" style={{ borderTop: `3px solid ${cor}` }}>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{l.rotulo}</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: cor }}>{l.dia}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Indicador de setor: o valor do dia e o da semana em blocos separados. */
export function Resumo({ rotulo, cor, dia, semana, mes, mensal = false, linhas, colunas = TODAS, rotuloDia = 'Do dia' }: { rotulo: string; cor: string; dia: string; semana: string; mes: string; mensal?: boolean; linhas?: { rotulo: string; valor: string }[]; colunas?: Coluna[]; rotuloDia?: string }) {
  if (linhas && linhas.length > 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4" style={{ borderTop: `3px solid ${cor}` }}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{rotulo}</p>
        <dl className="mt-2 divide-y divide-slate-100 text-sm">
          {linhas.map((l) => (
            <div key={l.rotulo} className="flex items-baseline justify-between gap-2 py-1">
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">{l.rotulo}</dt>
              <dd className="font-bold tabular-nums" style={{ color: cor }}>{l.valor}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }
  if (mensal) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4" style={{ borderTop: `3px solid ${cor}` }}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{rotulo}</p>
        <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-500">No mês</p>
        <p className="text-xl font-bold tabular-nums" style={{ color: cor }}>{mes}</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4" style={{ borderTop: `3px solid ${cor}` }}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{rotulo}</p>
      <dl className="mt-2 divide-y divide-slate-100 text-sm">
        {[
          { rotulo: rotuloDia, valor: dia, cor: '#0f172a', c: 'dia' as Coluna },
          { rotulo: 'Da semana', valor: semana, cor, c: 'semana' as Coluna },
          { rotulo: 'No mês', valor: mes, cor, c: 'mes' as Coluna },
        ].filter((l) => colunas.includes(l.c)).map((l) => (
          <div key={l.rotulo} className="flex items-baseline justify-between gap-2 py-1">
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">{l.rotulo}</dt>
            <dd className="font-bold tabular-nums" style={{ color: l.cor }}>{l.valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}


const brData = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');

/** Caminhão de solda na tela: uma linha por caminhão, no mesmo formato da tabela de trilheiros. */
export function CaminhoesBloco({ s, modo, colunas = TODAS }: { s: SetorRelatorio; modo: 'semanal' | 'diario' | 'mensal'; colunas?: Coluna[] }) {
  const mensal = modo === 'mensal';
  const diario = modo === 'diario';
  const mostraDia = !mensal && colunas.includes('dia');
  const mostraSem = !mensal && colunas.includes('semana');
  const mostraMes = colunas.includes('mes');
  const caminhoes = s.caminhoes ?? [];
  const cor = s.cor;
  // Um quadrado por caminhão, igual aos quadrados do estaleiro, geração e serra.
  const bloco = (rotulo: string, valores: { dia: string; semana: string; mes: string }) => (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{rotulo}</p>
      <dl className="mt-1 space-y-0.5 text-sm tabular-nums">
        {mostraDia && <div className="flex justify-between gap-2"><dt className="text-[11px] text-slate-500">Dia</dt><dd className="font-bold text-slate-900">{valores.dia}</dd></div>}
        {mostraSem && <div className="flex justify-between gap-2"><dt className="text-[11px] text-slate-500">Semana</dt><dd className="font-bold text-slate-900">{valores.semana}</dd></div>}
        {mostraMes && <div className="flex justify-between gap-2"><dt className="text-[11px] text-slate-500">No mês</dt><dd className="font-bold" style={{ color: cor }}>{valores.mes}</dd></div>}
      </dl>
    </div>
  );
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white break-inside-avoid">
      <header className="px-4 py-2.5 text-white" style={{ background: cor }}>
        <span className="text-sm font-bold">{s.titulo}</span>
      </header>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {caminhoes.map((c) => (
          <div key={c.nome} className="rounded-lg border border-slate-200 p-3" style={{ borderTop: `3px solid ${cor}` }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-900">{c.nome}</p>
              {c.local ? <span className="inline-block rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">{c.local}</span> : <span className="text-slate-400">—</span>}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {bloco('Solda (UND)', c.solda)}
              {bloco('Corte (UND)', c.corte)}
            </div>
            {diario && c.observacao && <p className="mt-2 text-[12px] leading-snug text-slate-600">{c.observacao}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Trilheiros: indicadores de topo e uma linha por equipe, como no informativo da Rumo. */
export function TrilheirosBloco({ t }: { t: TrilheirosRelatorio }) {
  const cor = '#0891b2';
  const cards = [
    { rotulo: 'Trilheiros ativos', valor: String(t.ativos) },
    { rotulo: 'Total de barras', valor: String(t.totalBarras) },
    { rotulo: 'Barras descarregadas', valor: String(t.descarregadas) },
    { rotulo: 'Progresso geral', valor: t.progresso == null ? '—' : `${t.progresso}%` },
  ];
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white break-inside-avoid">
      <header className="px-4 py-2.5 text-white" style={{ background: cor }}>
        <span className="text-sm font-bold">Trilheiros</span>
      </header>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {cards.map((c) => (
            <div key={c.rotulo} className="rounded-lg border border-slate-200 p-3" style={{ borderTop: `3px solid ${cor}` }}>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{c.rotulo}</p>
              <p className="text-lg font-bold tabular-nums text-slate-900">{c.valor}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[720px] table-fixed border-collapse text-[13px] print:min-w-0 print:text-[9px]">
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
              <col className="w-[32%]" />
            </colgroup>
            <thead>
              <tr className="border-b-2 border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="pb-2 text-left font-semibold">Trilheiro</th>
                <th className="pb-2 text-center font-semibold">B.O.</th>
                <th className="pb-2 text-center font-semibold leading-tight">Dias<br />desde B.O.</th>
                <th className="pb-2 text-center font-semibold">Partida</th>
                <th className="pb-2 text-center font-semibold leading-tight">Dias<br />desde partida</th>
                <th className="pb-2 text-center font-semibold">Local</th>
                <th className="pb-2 text-center font-semibold leading-tight">Barras<br />desc. / total</th>
                <th className="pb-2 text-left font-semibold">Observação</th>
              </tr>
            </thead>
            <tbody>
              {t.equipes.map((e, i) => (
                <tr key={e.trilheiro} className={`align-top ${i % 2 === 1 ? 'bg-slate-50' : ''}`}>
                  <td className="py-2.5 pl-2 font-bold text-slate-900">{e.trilheiro}</td>
                  <td className="py-2.5 text-center tabular-nums">{brData(e.bo)}</td>
                  <td className="py-2.5 text-center font-semibold tabular-nums">{e.giroDias ?? '—'}</td>
                  <td className="py-2.5 text-center tabular-nums">{brData(e.partida)}</td>
                  <td className="py-2.5 text-center font-semibold tabular-nums">{e.diasDesdePartida ?? '—'}</td>
                  <td className="py-2.5 text-center">
                    {e.local ? <span className="inline-block rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">{e.local}</span> : '—'}
                  </td>
                  <td className="py-2.5 text-center font-bold tabular-nums">{e.descarregadas} / {e.total}</td>
                  <td className="py-2.5 pr-2 text-[12px] leading-snug text-slate-600">{e.observacao ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

const fmtM = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Geração por equipe: o que cada líder produziu no dia e na semana. */
export function EquipesGeracao({ equipes, cor }: { equipes: EquipeGeracaoRelatorio[]; cor: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white break-inside-avoid">
      <header className="px-4 py-2.5 text-white" style={{ background: cor }}>
        <span className="text-sm font-bold">Geração por equipe</span>
      </header>
      <div className="overflow-x-auto p-4">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="pb-1 text-left font-semibold">Equipe</th>
              <th className="pb-1 text-right font-semibold">Carregado (m)</th>
              <th className="pb-1 text-right font-semibold">Deixado na via (m)</th>
              <th className="pb-1 text-right font-semibold">Barras</th>
            </tr>
          </thead>
          <tbody>
            {equipes.map((e) => (
              <tr key={e.rotulo} className="border-t border-slate-100">
                <td className="py-2 font-semibold text-slate-900">{e.rotulo}</td>
                <td className="py-2 text-right tabular-nums">
                  <span className="font-bold" style={{ color: cor }}>{fmtM(e.semana.carregamentoM)}</span>
                  <span className="block text-[11px] text-slate-500">dia {fmtM(e.dia.carregamentoM)}</span>
                </td>
                <td className="py-2 text-right tabular-nums">
                  <span className="font-bold" style={{ color: cor }}>{fmtM(e.semana.deixadaViaM)}</span>
                  <span className="block text-[11px] text-slate-500">dia {fmtM(e.dia.deixadaViaM)}</span>
                </td>
                <td className="py-2 text-right tabular-nums">
                  <span className="font-bold" style={{ color: cor }}>{e.semana.quantidade}</span>
                  <span className="block text-[11px] text-slate-500">dia {e.dia.quantidade}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
