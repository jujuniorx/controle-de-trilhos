import type { ReactNode } from 'react';
import {
  estaleiroDoPeriodo,
  geracaoDoPeriodo,
  composicoesDoPeriodo,
  caminhoesDoPeriodo,
  trilheirosDoPeriodo,
  rotuloComposicao,
} from '@/lib/services/usina';
import { seriesDoMes } from '@/lib/services/usinaGraficos';
import { GraficoBarras } from '@/components/usina/GraficoBarras';
import { fmtMetros, fmtPeso } from '@/lib/format';
import { ehIsoValido } from '@/lib/usina/periodo';
import { ImprimirBotao } from '@/components/usina/ImprimirBotao';

export const dynamic = 'force-dynamic';

const br = (iso: string) => iso.split('-').reverse().join('/');
const soma = <T,>(lista: T[], f: (x: T) => number) => lista.reduce((a, x) => a + f(x), 0);
const metros = (v: number) => `${fmtMetros(v)} m`;

type Linha = { rotulo: string; dia: ReactNode; mes: ReactNode };

/** Um setor: mesmo tamanho para todos. Cabeçalho colorido, tabela Dia × Mês e gráfico do mês embaixo. */
function Setor({ titulo, cor, linhas, grafico }: { titulo: string; cor: string; linhas: Linha[]; grafico: ReactNode }) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white break-inside-avoid">
      <header className="flex items-center gap-2 px-4 py-2.5 text-white" style={{ background: cor }}>
        <span className="text-sm font-bold uppercase tracking-wide">{titulo}</span>
      </header>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              <th className="pb-1 text-left font-semibold"> </th>
              <th className="pb-1 text-right font-semibold">Dia</th>
              <th className="pb-1 text-right font-semibold">Mês</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.rotulo} className="border-t border-slate-100">
                <td className="py-1 text-slate-700">{l.rotulo}</td>
                <td className="py-1 text-right font-medium tabular-nums text-slate-900">{l.dia}</td>
                <td className="py-1 text-right font-bold tabular-nums" style={{ color: cor }}>
                  {l.mes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-auto border-t border-slate-100 pt-2">{grafico}</div>
      </div>
    </section>
  );
}

/** Indicador de setor: o valor do dia e o do mês lado a lado, em blocos separados. */
function Resumo({ rotulo, cor, dia, mes }: { rotulo: string; cor: string; dia: string; mes: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3" style={{ borderTop: `3px solid ${cor}` }}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{rotulo}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-slate-50 p-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Do dia</p>
          <p className="text-base font-bold tabular-nums text-slate-900">{dia}</p>
        </div>
        <div className="rounded-md p-2" style={{ background: `${cor}14` }}>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Do mês</p>
          <p className="text-base font-bold tabular-nums" style={{ color: cor }}>{mes}</p>
        </div>
      </div>
    </div>
  );
}

const CORES = {
  estaleiro: '#2563eb',
  geracao: '#059669',
  composicoes: '#7c3aed',
  caminhao: '#ea580c',
  trilheiros: '#0891b2',
};

export default async function OnePageUsina({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const params = await searchParams;
  const data = ehIsoValido(params.data) ? params.data : new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

  const serie = await seriesDoMes(data);
  const [estD, estM, gerD, gerM, compD, compM, camD, camM, trilD, trilM] = await Promise.all([
    estaleiroDoPeriodo('dia', data),
    estaleiroDoPeriodo('mes', data),
    geracaoDoPeriodo('dia', data),
    geracaoDoPeriodo('mes', data),
    composicoesDoPeriodo('dia', data),
    composicoesDoPeriodo('mes', data),
    caminhoesDoPeriodo('dia', data),
    caminhoesDoPeriodo('mes', data),
    trilheirosDoPeriodo('dia', data),
    trilheirosDoPeriodo('mes', data),
  ]);

  const metrosMesGerados = soma(gerM.porLider, (l) => l.mes.totalM);
  const barrasMesComposicoes = soma(compM, (c) => c.barras);
  const producaoMesCaminhoes = soma(camM, (c) => c.mes.producao);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <style>{`
        @page { size: A4; margin: 8mm; }
        @media print {
          body * { visibility: hidden; }
          #one-page-usina, #one-page-usina * { visibility: visible; }
          #one-page-usina { position: absolute; left: 0; top: 0; width: 100%; padding: 0; background: #fff; }
          .sem-impressao { display: none !important; }
          #one-page-usina { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="sem-impressao flex flex-wrap items-center gap-3">
        <ImprimirBotao rotulo="Salvar como PDF" />
        <a className="btn btn-ghost h-11" href={`/admin/usina?data=${data}`}>Voltar</a>
        <p className="w-full text-xs text-ink-muted">No PC: na janela de impressão, em Destino, escolha "Salvar como PDF". No iPhone: toque em Compartilhar e depois em "Salvar em Arquivos" ou "Imprimir" e abra o PDF pela visualização.</p>
        <form action="" className="flex items-center gap-2 text-sm">
          <label htmlFor="data">Dia</label>
          <input id="data" name="data" type="date" defaultValue={data} className="h-11" />
          <button className="btn btn-ghost h-11" type="submit">Ver</button>
        </form>
      </div>

      <article id="one-page-usina" className="space-y-4 rounded-2xl bg-slate-50 p-5 text-slate-900">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-slate-900 pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Controle de Trilhos</p>
            <h1 className="text-2xl font-extrabold tracking-tight">One page — Usina</h1>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Dia de referência</p>
            <p className="text-lg font-bold tabular-nums">{br(data)}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Resumo rotulo="Estaleiro de solda" cor={CORES.estaleiro} dia={String(estD.totais.soldas)} mes={String(estM.totais.soldas)} />
          <Resumo rotulo="Geração de trilho" cor={CORES.geracao} dia={metros(soma(gerD.porLider, (l) => l.periodo.carregamentoM + l.periodo.deixadaViaM))} mes={metros(soma(gerM.porLider, (l) => l.mes.carregamentoM + l.mes.deixadaViaM))} />
          <Resumo rotulo="Composições" cor={CORES.composicoes} dia={String(soma(compD, (c) => c.barras))} mes={String(barrasMesComposicoes)} />
          <Resumo rotulo="Caminhão de solda" cor={CORES.caminhao} dia={String(soma(camD, (c) => c.periodo.producao))} mes={String(producaoMesCaminhoes)} />
        </div>

        <p className="text-xs text-slate-500">Cada setor abaixo mostra o valor do dia e o acumulado do mês, com o gráfico dos dias do mês.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Setor
            titulo="Estaleiro de solda"
            cor={CORES.estaleiro}
            linhas={[
              { rotulo: 'Soldas', dia: estD.totais.soldas, mes: estM.totais.soldas },
              { rotulo: 'Cortes', dia: estD.totais.cortes, mes: estM.totais.cortes },
              { rotulo: 'Tampões carregados', dia: estD.carreta.tampoes, mes: estM.carreta.tampoes },
              { rotulo: 'Trilho novo carregado', dia: metros(estD.carreta.trilhoNovoM), mes: metros(estM.carreta.trilhoNovoM) },
              { rotulo: 'Sucata saída', dia: `${fmtPeso(estD.carreta.sucataT)} t`, mes: `${fmtPeso(estM.carreta.sucataT)} t` },
            ]}
            grafico={
              <GraficoBarras
                titulo="Soldas e cortes por dia"
                rotulos={serie.rotulos}
                series={[
                  { nome: 'Soldas', cor: CORES.estaleiro, valores: serie.estaleiro.soldas },
                  { nome: 'Cortes', cor: '#94a3b8', valores: serie.estaleiro.cortes },
                ]}
              />
            }
          />

          <Setor
            titulo="Geração de trilho"
            cor={CORES.geracao}
            linhas={[
              { rotulo: 'Corte', dia: metros(soma(gerD.porLider, (l) => l.periodo.corteM)), mes: metros(soma(gerM.porLider, (l) => l.mes.corteM)) },
              { rotulo: 'Carregado', dia: metros(soma(gerD.porLider, (l) => l.periodo.carregamentoM)), mes: metros(soma(gerM.porLider, (l) => l.mes.carregamentoM)) },
              { rotulo: 'Deixado na via', dia: metros(soma(gerD.porLider, (l) => l.periodo.deixadaViaM)), mes: metros(soma(gerM.porLider, (l) => l.mes.deixadaViaM)) },
              { rotulo: 'Barras', dia: soma(gerD.porLider, (l) => l.periodo.quantidade), mes: soma(gerM.porLider, (l) => l.mes.quantidade) },
            ]}
            grafico={
              <GraficoBarras
                titulo="Metros por dia"
                unidade=" m"
                rotulos={serie.rotulos}
                series={[
                  { nome: 'Corte', cor: '#94a3b8', valores: serie.geracao.corte },
                  { nome: 'Carregado', cor: CORES.geracao, valores: serie.geracao.carregado },
                  { nome: 'Deixado na via', cor: '#f59e0b', valores: serie.geracao.deixado },
                ]}
              />
            }
          />

          <Setor
            titulo="Composições ativas"
            cor={CORES.composicoes}
            linhas={compM.flatMap((c) => {
              const d = compD.find((x) => x.ativo === c.ativo);
              return [
                { rotulo: `${rotuloComposicao(c.ativo)} · barras`, dia: d?.barras ?? 0, mes: c.barras },
                { rotulo: `${rotuloComposicao(c.ativo)} · jacarés`, dia: d?.jacares ?? 0, mes: c.jacares },
              ];
            })}
            grafico={
              <GraficoBarras
                titulo="Barras por dia"
                rotulos={serie.rotulos}
                series={[
                  { nome: rotuloComposicao('W61'), cor: CORES.composicoes, valores: serie.composicoes.W61 ?? [] },
                  { nome: rotuloComposicao('W62'), cor: '#a78bfa', valores: serie.composicoes.W62 ?? [] },
                ]}
              />
            }
          />

          <Setor
            titulo="Caminhão de solda"
            cor={CORES.caminhao}
            linhas={camM.flatMap((c) => {
              const d = camD.find((x) => x.caminhao === c.caminhao);
              return [
                { rotulo: `${c.caminhao} · produção`, dia: d?.periodo.producao ?? 0, mes: c.mes.producao },
                { rotulo: `${c.caminhao} · perda`, dia: d?.periodo.perda ?? 0, mes: c.mes.perda },
              ];
            })}
            grafico={
              <GraficoBarras
                titulo="Produção por dia"
                rotulos={serie.rotulos}
                series={[
                  { nome: 'CW01', cor: CORES.caminhao, valores: serie.caminhao.CW01 ?? [] },
                  { nome: 'CW02', cor: '#fb923c', valores: serie.caminhao.CW02 ?? [] },
                ]}
              />
            }
          />

          <Setor
            titulo="Trilheiros"
            cor={CORES.trilheiros}
            linhas={[
              { rotulo: 'Giros', dia: trilD.giros.length, mes: trilM.giros.length },
              { rotulo: 'Média de dias úteis na usina', dia: '—', mes: trilM.mediaDiasUteisNaUsina ?? '—' },
            ]}
            grafico={
              <p className="py-6 text-center text-xs text-slate-400">Sem gráfico diário para trilheiros.</p>
            }
          />
        </div>
      </article>
    </main>
  );
}
