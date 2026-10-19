import {
  estaleiroDoPeriodo,
  geracaoDoPeriodo,
  composicoesDoPeriodo,
  caminhoesDoPeriodo,
  trilheirosDoPeriodo,
  rotuloComposicao,
} from '@/lib/services/usina';
import { seriesDoMes } from '@/lib/services/usinaGraficos';
import { fmtMetros, fmtPeso } from '@/lib/format';

const soma = <T,>(lista: T[], f: (x: T) => number) => lista.reduce((a, x) => a + f(x), 0);
const metros = (v: number) => `${fmtMetros(v)} m`;

export interface LinhaOnePage { rotulo: string; dia: string; mes: string }
export interface GraficoOnePage { titulo: string; series: { nome: string; cor: string; valores: number[] }[] }
export interface SetorOnePage { titulo: string; cor: string; linhas: LinhaOnePage[]; grafico: GraficoOnePage | null }

export interface DadosOnePage {
  data: string;
  resumo: { rotulo: string; cor: string; dia: string; mes: string }[];
  setores: SetorOnePage[];
}

const CORES = { estaleiro: '#2563eb', geracao: '#059669', composicoes: '#7c3aed', caminhao: '#ea580c', trilheiros: '#0891b2' };

/** Mesmos números da tela one page da usina, em forma simples para o PDF. */
export async function montarDadosOnePage(data: string): Promise<DadosOnePage> {
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

  const geraDia = (f: (l: (typeof gerD.porLider)[number]) => number) => soma(gerD.porLider, f);
  const geraMes = (f: (l: (typeof gerM.porLider)[number]) => number) => soma(gerM.porLider, f);
  const barrasMesComp = soma(compM, (c) => c.barras);
  const producaoMesCam = soma(camM, (c) => c.mes.producao);

  return {
    data,
    resumo: [
      { rotulo: 'Estaleiro de solda', cor: CORES.estaleiro, dia: String(estD.totais.soldas), mes: String(estM.totais.soldas) },
      {
        rotulo: 'Geração de trilho',
        cor: CORES.geracao,
        dia: metros(geraDia((l) => l.periodo.carregamentoM + l.periodo.deixadaViaM)),
        mes: metros(geraMes((l) => l.mes.carregamentoM + l.mes.deixadaViaM)),
      },
      { rotulo: 'Composições', cor: CORES.composicoes, dia: String(soma(compD, (c) => c.barras)), mes: String(barrasMesComp) },
      { rotulo: 'Caminhão de solda', cor: CORES.caminhao, dia: String(soma(camD, (c) => c.periodo.producao)), mes: String(producaoMesCam) },
    ],
    setores: [
      {
        titulo: 'Estaleiro de solda',
        cor: CORES.estaleiro,
        linhas: [
          { rotulo: 'Soldas', dia: String(estD.totais.soldas), mes: String(estM.totais.soldas) },
          { rotulo: 'Cortes', dia: String(estD.totais.cortes), mes: String(estM.totais.cortes) },
          { rotulo: 'Tampões carregados', dia: String(estD.carreta.tampoes), mes: String(estM.carreta.tampoes) },
          { rotulo: 'Trilho novo carregado', dia: metros(estD.carreta.trilhoNovoM), mes: metros(estM.carreta.trilhoNovoM) },
          { rotulo: 'Sucata saída', dia: `${fmtPeso(estD.carreta.sucataT)} t`, mes: `${fmtPeso(estM.carreta.sucataT)} t` },
        ],
        grafico: {
          titulo: 'Soldas e cortes por dia',
          series: [
            { nome: 'Soldas', cor: '#2563eb', valores: serie.estaleiro.soldas },
            { nome: 'Cortes', cor: '#f59e0b', valores: serie.estaleiro.cortes },
          ],
        },
      },
      {
        titulo: 'Geração de trilho',
        cor: CORES.geracao,
        linhas: [
          { rotulo: 'Corte', dia: metros(geraDia((l) => l.periodo.corteM)), mes: metros(geraMes((l) => l.mes.corteM)) },
          { rotulo: 'Carregado', dia: metros(geraDia((l) => l.periodo.carregamentoM)), mes: metros(geraMes((l) => l.mes.carregamentoM)) },
          { rotulo: 'Deixado na via', dia: metros(geraDia((l) => l.periodo.deixadaViaM)), mes: metros(geraMes((l) => l.mes.deixadaViaM)) },
          { rotulo: 'Barras', dia: String(geraDia((l) => l.periodo.quantidade)), mes: String(geraMes((l) => l.mes.quantidade)) },
        ],
        grafico: {
          titulo: 'Metros por dia',
          series: [
            { nome: 'Corte', cor: '#64748b', valores: serie.geracao.corte },
            { nome: 'Carregado', cor: '#059669', valores: serie.geracao.carregado },
            { nome: 'Deixado na via', cor: '#db2777', valores: serie.geracao.deixado },
          ],
        },
      },
      {
        titulo: 'Composições ativas',
        cor: CORES.composicoes,
        linhas: compM.flatMap((c) => {
          const d = compD.find((x) => x.ativo === c.ativo);
          return [
            { rotulo: `${rotuloComposicao(c.ativo)} · barras`, dia: String(d?.barras ?? 0), mes: String(c.barras) },
            { rotulo: `${rotuloComposicao(c.ativo)} · jacarés`, dia: String(d?.jacares ?? 0), mes: String(c.jacares) },
          ];
        }),
        grafico: {
          titulo: 'Barras por dia',
          series: [
            { nome: rotuloComposicao('W61'), cor: '#7c3aed', valores: serie.composicoes.W61 ?? [] },
            { nome: rotuloComposicao('W62'), cor: '#0891b2', valores: serie.composicoes.W62 ?? [] },
          ],
        },
      },
      {
        titulo: 'Caminhão de solda',
        cor: CORES.caminhao,
        linhas: camM.flatMap((c) => {
          const d = camD.find((x) => x.caminhao === c.caminhao);
          return [
            { rotulo: `${c.caminhao} · produção`, dia: String(d?.periodo.producao ?? 0), mes: String(c.mes.producao) },
            { rotulo: `${c.caminhao} · perda`, dia: String(d?.periodo.perda ?? 0), mes: String(c.mes.perda) },
          ];
        }),
        grafico: {
          titulo: 'Produção por dia',
          series: [
            { nome: 'CW01', cor: '#ea580c', valores: serie.caminhao.CW01 ?? [] },
            { nome: 'CW02', cor: '#84cc16', valores: serie.caminhao.CW02 ?? [] },
          ],
        },
      },
      {
        titulo: 'Trilheiros',
        cor: CORES.trilheiros,
        linhas: [
          { rotulo: 'Giros', dia: String(trilD.giros.length), mes: String(trilM.giros.length) },
          { rotulo: 'Média de dias úteis na usina', dia: '—', mes: trilM.mediaDiasUteisNaUsina == null ? '—' : String(trilM.mediaDiasUteisNaUsina) },
        ],
        grafico: null,
      },
    ],
  };
}
