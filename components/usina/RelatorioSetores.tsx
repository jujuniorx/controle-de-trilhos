import { GraficoBarras } from '@/components/usina/GraficoBarras';
import type { SetorRelatorio, TrilheirosRelatorio, EquipeGeracaoRelatorio } from '@/lib/services/onePageUsina';

/** Um setor: cabeçalho colorido, tabela Dia | Semana e o gráfico de segunda a domingo. */
export function Setor({ s, rotulosDias, largo = false }: { s: SetorRelatorio; rotulosDias: string[]; largo?: boolean }) {
  const tabela = (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="text-[11px] uppercase tracking-wide text-slate-500">
          <th className="pb-1 text-left font-semibold"> </th>
          <th className="pb-1 text-right font-semibold">Dia</th>
          <th className="pb-1 text-right font-semibold">Semana</th>
          <th className="pb-1 text-right font-semibold">No mês</th>
        </tr>
      </thead>
      <tbody>
        {s.linhas.map((l) => (
          <tr key={l.rotulo} className="border-t border-slate-100">
            <td className="py-1 text-slate-700">{l.rotulo}</td>
            <td className="py-1 text-right font-medium tabular-nums text-slate-900">{l.dia}</td>
            <td className="py-1 text-right font-medium tabular-nums text-slate-900">{l.semana}</td>
            <td className="py-1 text-right font-bold tabular-nums" style={{ color: s.cor }}>{l.mes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  // Quando o setor tem grade diária (caminhão), mostra os números de cada dia em vez do gráfico.
  const grafico = s.grade ? (
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
  ) : s.grafico ? (
    <div>
      <GraficoBarras
        titulo={s.grafico.titulo}
        rotulos={rotulosDias}
        series={s.grafico.series.map((x) => ({ nome: x.nome, cor: x.cor, valores: x.valores }))}
      />
    </div>
  ) : (
    <p className="py-6 text-center text-xs text-slate-400">Sem gráfico diário para este setor.</p>
  );
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white break-inside-avoid">
      <header className="px-4 py-2.5 text-white" style={{ background: s.cor }}>
        <span className="text-sm font-bold uppercase tracking-wide">{s.titulo}</span>
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
    </section>
  );
}

/** Indicador de setor: o valor do dia e o da semana em blocos separados. */
export function Resumo({ rotulo, cor, dia, mes }: { rotulo: string; cor: string; dia: string; mes: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3" style={{ borderTop: `3px solid ${cor}` }}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{rotulo}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-slate-50 p-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Do dia</p>
          <p className="text-base font-bold tabular-nums text-slate-900">{dia}</p>
        </div>
        <div className="rounded-md p-2" style={{ background: `${cor}14` }}>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Da semana</p>
          <p className="text-base font-bold tabular-nums" style={{ color: cor }}>{mes}</p>
        </div>
      </div>
    </div>
  );
}


const brData = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');

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
        <span className="text-sm font-bold uppercase tracking-wide">Trilheiros</span>
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

const fmtM = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;

/** Geração por equipe: o que cada líder produziu no dia e na semana. */
export function EquipesGeracao({ equipes, cor }: { equipes: EquipeGeracaoRelatorio[]; cor: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white break-inside-avoid">
      <header className="px-4 py-2.5 text-white" style={{ background: cor }}>
        <span className="text-sm font-bold uppercase tracking-wide">Geração por equipe</span>
      </header>
      <div className="overflow-x-auto p-4">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="pb-1 text-left font-semibold">Equipe</th>
              <th className="pb-1 text-right font-semibold">Corte</th>
              <th className="pb-1 text-right font-semibold">Carregado</th>
              <th className="pb-1 text-right font-semibold">Deixado na via</th>
              <th className="pb-1 text-right font-semibold">Barras</th>
            </tr>
          </thead>
          <tbody>
            {equipes.map((e) => (
              <tr key={e.rotulo} className="border-t border-slate-100">
                <td className="py-2 font-semibold text-slate-900">{e.rotulo}</td>
                <td className="py-2 text-right tabular-nums">
                  <span className="font-bold" style={{ color: cor }}>{fmtM(e.semana.corteM)}</span>
                  <span className="block text-[11px] text-slate-500">dia {fmtM(e.dia.corteM)}</span>
                </td>
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
