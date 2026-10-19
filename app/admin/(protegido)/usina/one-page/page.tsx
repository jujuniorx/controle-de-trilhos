import type { ReactNode } from 'react';
import {
  estaleiroDoPeriodo,
  geracaoDoPeriodo,
  composicoesDoPeriodo,
  caminhoesDoPeriodo,
  trilheirosDoPeriodo,
  META_GERACAO_MENSAL_M,
} from '@/lib/services/usina';
import { seriesDoMes } from '@/lib/services/usinaGraficos';
import { GraficoBarras } from '@/components/usina/GraficoBarras';
import { fmtMetros, fmtPeso } from '@/lib/format';
import { ehIsoValido } from '@/lib/usina/periodo';
import { ImprimirBotao } from '@/components/usina/ImprimirBotao';

export const dynamic = 'force-dynamic';

const br = (iso: string) => iso.split('-').reverse().join('/');
const soma = <T,>(lista: T[], f: (x: T) => number) => lista.reduce((a, x) => a + f(x), 0);

/** Um setor: mesmo tamanho para todos. Dia à esquerda, mês à direita, gráfico embaixo. */
function Setor({ titulo, dia, mes, grafico }: { titulo: string; dia: ReactNode; mes: ReactNode; grafico?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border-2 border-black/70 p-3 break-inside-avoid">
      <h2 className="border-b border-black/30 pb-1 text-base font-bold">{titulo}</h2>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-1">
          <p className="font-semibold">Acumulado do dia</p>
          {dia}
        </div>
        <div className="space-y-1">
          <p className="font-semibold">Acumulado do mês</p>
          {mes}
        </div>
      </div>
      {grafico}
    </section>
  );
}

function Itens({ itens }: { itens: [string, string | number][] }) {
  return (
    <ul className="space-y-0.5">
      {itens.map(([rotulo, valor]) => (
        <li key={rotulo} className="flex justify-between gap-2 border-b border-black/10 py-0.5">
          <span>{rotulo}</span>
          <b className="tabular-nums">{valor}</b>
        </li>
      ))}
    </ul>
  );
}

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

  const totalGerMes = soma(gerM.porLider, (l) => l.mes.totalM);
  const metaOk = totalGerMes >= META_GERACAO_MENSAL_M;

  const estItens = (x: typeof estD): [string, string | number][] => [
    ['Soldas', x.totais.soldas],
    ['Cortes', x.totais.cortes],
    ['Tampões carregados', x.carreta.tampoes],
    ['Trilho novo carregado', `${fmtMetros(x.carreta.trilhoNovoM)} m`],
    ['Sucata saída', `${fmtPeso(x.carreta.sucataT)} t`],
  ];

  const compItens = (lista: typeof compD): [string, string | number][] =>
    lista.map((c) => [c.ativo, `${c.barras} barras · ${c.jacares} jacarés`]);

  const camItens = (lista: typeof camD, mesmo: boolean): [string, string | number][] =>
    lista.flatMap((c) => {
      const v = mesmo ? c.mes : c.periodo;
      return [
        [`${c.caminhao} — produção`, v.producao],
        [`${c.caminhao} — perda`, v.perda],
      ] as [string, string | number][];
    });

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #one-page-usina, #one-page-usina * { visibility: visible; }
          #one-page-usina { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .sem-impressao { display: none !important; }
        }
      `}</style>

      <div className="sem-impressao flex flex-wrap items-center gap-3">
        <ImprimirBotao />
        <a className="btn btn-ghost h-11" href={`/admin/usina?data=${data}`}>Voltar</a>
        <form action="" className="flex items-center gap-2 text-sm">
          <label htmlFor="data">Dia</label>
          <input id="data" name="data" type="date" defaultValue={data} className="h-11" />
          <button className="btn btn-ghost h-11" type="submit">Ver</button>
        </form>
      </div>

      <article id="one-page-usina" className="space-y-4 bg-white p-4 text-black">
        <header>
          <h1 className="text-xl font-bold">One page — Usina</h1>
          <p className="text-sm">Dia {br(data)} · Acumulado do dia e do mês, por setor</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Setor
            titulo="Estaleiro de solda"
            dia={<Itens itens={estItens(estD)} />}
            mes={<Itens itens={estItens(estM)} />}
            grafico={
              <GraficoBarras
                titulo="Soldas e cortes por dia (mês)"
                rotulos={serie.rotulos}
                series={[
                  { nome: 'Soldas', cor: '#2563eb', valores: serie.estaleiro.soldas },
                  { nome: 'Cortes', cor: '#059669', valores: serie.estaleiro.cortes },
                ]}
              />
            }
          />
          <Setor
            titulo="Geração de trilho"
            dia={
              <Itens
                itens={[
                  ['Corte', `${fmtMetros(soma(gerD.porLider, (l) => l.periodo.corteM))} m`],
                  ['Carregado', `${fmtMetros(soma(gerD.porLider, (l) => l.periodo.carregamentoM))} m`],
                  ['Deixado na via', `${fmtMetros(soma(gerD.porLider, (l) => l.periodo.deixadaViaM))} m`],
                  ['Barras', soma(gerD.porLider, (l) => l.periodo.quantidade)],
                ]}
              />
            }
            mes={
              <Itens
                itens={[
                  ['Carregado + deixado', `${fmtMetros(totalGerMes)} m`],
                  ['Meta do mês', `${fmtMetros(META_GERACAO_MENSAL_M)} m`],
                  ['Situação', metaOk ? 'Meta alcançada' : 'Abaixo da meta'],
                ]}
              />
            }
            grafico={
              <GraficoBarras
                titulo="Metros por dia (mês)"
                unidade=" m"
                rotulos={serie.rotulos}
                series={[
                  { nome: 'Corte', cor: '#64748b', valores: serie.geracao.corte },
                  { nome: 'Carregado', cor: '#2563eb', valores: serie.geracao.carregado },
                  { nome: 'Deixado na via', cor: '#f59e0b', valores: serie.geracao.deixado },
                ]}
              />
            }
          />
          <Setor
            titulo="Composições ativas"
            dia={<Itens itens={compItens(compD)} />}
            mes={<Itens itens={compItens(compM)} />}
            grafico={
              <GraficoBarras
                titulo="Barras por dia (mês)"
                rotulos={serie.rotulos}
                series={[
                  { nome: 'W61', cor: '#2563eb', valores: serie.composicoes.W61 ?? [] },
                  { nome: 'W62', cor: '#059669', valores: serie.composicoes.W62 ?? [] },
                ]}
              />
            }
          />
          <Setor
            titulo="Caminhão de solda"
            dia={<Itens itens={camItens(camD, false)} />}
            mes={<Itens itens={camItens(camM, true)} />}
            grafico={
              <GraficoBarras
                titulo="Produção por dia (mês)"
                rotulos={serie.rotulos}
                series={[
                  { nome: 'CW01', cor: '#2563eb', valores: serie.caminhao.CW01 ?? [] },
                  { nome: 'CW02', cor: '#059669', valores: serie.caminhao.CW02 ?? [] },
                ]}
              />
            }
          />
          <Setor
            titulo="Trilheiros"
            dia={<Itens itens={[['Giros', trilD.giros.length]]} />}
            mes={
              <Itens
                itens={[
                  ['Giros', trilM.giros.length],
                  ['Média de dias úteis na usina', trilM.mediaDiasUteisNaUsina ?? '—'],
                ]}
              />
            }
          />
        </div>
      </article>
    </main>
  );
}
