import {
  estaleiroDoPeriodo,
  geracaoDoPeriodo,
  caminhoesDoPeriodo,
  trilheirosDoPeriodo,
  listarCiclosAbertos,
  TRILHEIROS,
} from '@/lib/services/usina';
import { seriesDoMes } from '@/lib/services/usinaGraficos';
import { prisma } from '@/lib/db';
import { intervaloDoPeriodo } from '@/lib/usina/periodo';
import { METROS_POR_UNIDADE, ROTULO_CIDADE, CIDADES_SERRA } from '@/lib/services/serra';
import { fmtMetros, fmtPeso } from '@/lib/format';

const soma = <T,>(lista: T[], f: (x: T) => number) => lista.reduce((a, x) => a + f(x), 0);
const metros = (v: number) => `${fmtMetros(v)} m`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export interface LinhaRelatorio { rotulo: string; dia: string; mes: string }
export interface GraficoRelatorio { titulo: string; series: { nome: string; cor: string; valores: number[] }[] }
export interface SetorRelatorio { titulo: string; cor: string; linhas: LinhaRelatorio[]; grafico: GraficoRelatorio | null }

export interface DadosRelatorio {
  data: string;
  rotulosDias: string[];
  resumo: { rotulo: string; cor: string; dia: string; mes: string; grupo: string }[];
  setores: SetorRelatorio[];
}

/** Cores fixas por setor (cabeçalho) e uma cor distinta para cada série dentro do setor. */
export const CORES_SETOR = { estaleiro: '#2563eb', geracao: '#059669', serra: '#be123c', caminhao: '#ea580c', trilheiros: '#0891b2' };

/** Mesmos números do relatório gerencial da usina, em forma simples para a tela e para o PDF. */
export async function montarDadosRelatorio(data: string): Promise<DadosRelatorio> {
  const serie = await seriesDoMes(data);
  const { inicio, fim } = intervaloDoPeriodo('mes', data);
  const dias = serie.rotulos.length;

  const [estD, estM, gerD, gerM, camD, camM, trilD, trilM, serraMes] = await Promise.all([
    estaleiroDoPeriodo('dia', data),
    estaleiroDoPeriodo('mes', data),
    geracaoDoPeriodo('dia', data),
    geracaoDoPeriodo('mes', data),
    caminhoesDoPeriodo('dia', data),
    caminhoesDoPeriodo('mes', data),
    trilheirosDoPeriodo('dia', data),
    trilheirosDoPeriodo('mes', data),
    prisma.recolhimentoSerra.findMany({
      where: { data: { gte: new Date(`${inicio}T00:00:00Z`), lte: new Date(`${fim}T00:00:00Z`) } },
      select: { data: true, cidade: true, unidades: true },
    }),
  ]);

  // Serra: unidades × 10 m, por cidade, no dia e no mês; e uma série diária por cidade para o gráfico.
  const serraDia = (cidade: string) =>
    serraMes.filter((r) => r.cidade === cidade && iso(r.data) === data).reduce((t, r) => t + r.unidades * METROS_POR_UNIDADE, 0);
  const serraMesM = (cidade: string) => serraMes.filter((r) => r.cidade === cidade).reduce((t, r) => t + r.unidades * METROS_POR_UNIDADE, 0);
  const serraDiaSerie = (cidade: string) => {
    const valores = new Array<number>(dias).fill(0);
    for (const r of serraMes) if (r.cidade === cidade) valores[Number(iso(r.data).slice(8, 10)) - 1] += r.unidades * METROS_POR_UNIDADE;
    return valores;
  };
  const serraTotalDia = CIDADES_SERRA.reduce((t, c) => t + serraDia(c), 0);
  const serraTotalMes = CIDADES_SERRA.reduce((t, c) => t + serraMesM(c), 0);

  const geraDia = (f: (l: (typeof gerD.porLider)[number]) => number) => soma(gerD.porLider, f);
  const geraMes = (f: (l: (typeof gerM.porLider)[number]) => number) => soma(gerM.porLider, f);

  return {
    data,
    rotulosDias: serie.rotulos,
    resumo: [
      { rotulo: 'Estaleiro de solda', cor: CORES_SETOR.estaleiro, dia: `${estD.totais.soldas} UND`, mes: `${estM.totais.soldas} UND`, grupo: 'Estaleiro de solda' },
      {
        rotulo: 'Geração de trilho',
        cor: CORES_SETOR.geracao,
        dia: metros(geraDia((l) => l.periodo.carregamentoM + l.periodo.deixadaViaM)),
        mes: metros(geraMes((l) => l.mes.carregamentoM + l.mes.deixadaViaM)),
        grupo: 'Geração de trilho',
      },
      { rotulo: 'Recolhimento serra', cor: CORES_SETOR.serra, dia: metros(serraTotalDia), mes: metros(serraTotalMes), grupo: 'Recolhimento serra' },
      ...['CW01', 'CW02'].map((cw, i) => ({
        rotulo: cw,
        cor: i === 0 ? CORES_SETOR.caminhao : '#84cc16',
        dia: `${camD.find((c) => c.caminhao === cw)?.periodo.producao ?? 0} UND`,
        mes: `${camM.find((c) => c.caminhao === cw)?.mes.producao ?? 0} UND`,
        grupo: 'Caminhão de solda',
      })),
      {
        rotulo: 'Trilheiros',
        cor: CORES_SETOR.trilheiros,
        dia: `${trilD.giros.length} giros`,
        mes: `${trilM.giros.length} giros`,
        grupo: 'Trilheiros',
      },
    ],
    setores: [
      {
        titulo: 'Estaleiro de solda',
        cor: CORES_SETOR.estaleiro,
        linhas: [
          { rotulo: 'Soldas (UND)', dia: String(estD.totais.soldas), mes: String(estM.totais.soldas) },
          { rotulo: 'Cortes (UND)', dia: String(estD.totais.cortes), mes: String(estM.totais.cortes) },
          { rotulo: 'Tampões carregados (UND)', dia: String(estD.carreta.tampoes), mes: String(estM.carreta.tampoes) },
          { rotulo: 'Trilho novo carregado (m)', dia: metros(estD.carreta.trilhoNovoM), mes: metros(estM.carreta.trilhoNovoM) },
          { rotulo: 'Sucata saída (t)', dia: `${fmtPeso(estD.carreta.sucataT)} t`, mes: `${fmtPeso(estM.carreta.sucataT)} t` },
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
        cor: CORES_SETOR.geracao,
        linhas: [
          { rotulo: 'Corte (m)', dia: metros(geraDia((l) => l.periodo.corteM)), mes: metros(geraMes((l) => l.mes.corteM)) },
          { rotulo: 'Carregado (m)', dia: metros(geraDia((l) => l.periodo.carregamentoM)), mes: metros(geraMes((l) => l.mes.carregamentoM)) },
          { rotulo: 'Deixado na via (m)', dia: metros(geraDia((l) => l.periodo.deixadaViaM)), mes: metros(geraMes((l) => l.mes.deixadaViaM)) },
          { rotulo: 'Barras (UND)', dia: String(geraDia((l) => l.periodo.quantidade)), mes: String(geraMes((l) => l.mes.quantidade)) },
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
        titulo: 'Recolhimento serra',
        cor: CORES_SETOR.serra,
        linhas: [
          ...CIDADES_SERRA.map((c) => ({ rotulo: `${ROTULO_CIDADE[c]} · recolhido (m)`, dia: metros(serraDia(c)), mes: metros(serraMesM(c)) })),
          { rotulo: 'Total recolhido (m)', dia: metros(serraTotalDia), mes: metros(serraTotalMes) },
        ],
        grafico: {
          titulo: 'Metros recolhidos por dia',
          series: CIDADES_SERRA.map((c, i) => ({
            nome: ROTULO_CIDADE[c],
            cor: i === 0 ? '#7c3aed' : '#f59e0b',
            valores: serraDiaSerie(c),
          })),
        },
      },
      {
        titulo: 'Caminhão de solda',
        cor: CORES_SETOR.caminhao,
        linhas: camM.map((c) => {
          const d = camD.find((x) => x.caminhao === c.caminhao);
          return {
            rotulo: c.caminhao,
            dia: `${d?.periodo.producao ?? 0} UND prod. · ${d?.periodo.perda ?? 0} UND cortes`,
            mes: `${c.mes.producao} UND prod. · ${c.mes.perda} UND cortes`,
          };
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
        cor: CORES_SETOR.trilheiros,
        linhas: TRILHEIROS.flatMap((t) => [
          { rotulo: `${t} · giros`, dia: String(trilD.giros.filter((g) => g.trilheiro === t).length), mes: String(trilM.giros.filter((g) => g.trilheiro === t).length) },
          {
            rotulo: `${t} · TLS carregados`,
            dia: `${soma(trilD.giros.filter((g) => g.trilheiro === t), (g) => g.carregados)} TLS`,
            mes: `${soma(trilM.giros.filter((g) => g.trilheiro === t), (g) => g.carregados)} TLS`,
          },
        ]).concat([
          { rotulo: 'Média de dias úteis na usina', dia: '—', mes: trilM.mediaDiasUteisNaUsina == null ? '—' : String(trilM.mediaDiasUteisNaUsina) },
        ]),
        grafico: null,
      },
    ],
  };
}

export interface EquipeTrilheiro {
  trilheiro: string;
  giroDias: number | null;
  partida: string | null;
  local: string | null;
  carregados: number;
  descarregados: number;
  percentual: number | null;
  status: string;
}

export interface TrilheirosRelatorio {
  ativos: number;
  totalBarras: number;
  descarregadas: number;
  progresso: number | null;
  equipes: EquipeTrilheiro[];
}

/** Situacao atual dos giros abertos: uma linha por equipe, com os indicadores de topo. */
export async function montarTrilheirosRelatorio(data: string): Promise<TrilheirosRelatorio> {
  const ciclos = await listarCiclosAbertos();
  const diaMs = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const equipes: EquipeTrilheiro[] = TRILHEIROS.map((t, i) => {
    const c = ciclos[i];
    if (!c) {
      return { trilheiro: t, giroDias: null, partida: null, local: null, carregados: 0, descarregados: 0, percentual: null, status: 'Sem giro' };
    }
    const partida = c.partidaEm ? c.partidaEm.toISOString().slice(0, 10) : null;
    const giroDias = partida ? Math.round((diaMs(data) - diaMs(partida)) / 86400000) : null;
    const percentual = c.carregados > 0 ? Math.round((c.descarregados / c.carregados) * 100) : null;
    return {
      trilheiro: t,
      giroDias,
      partida,
      local: c.local,
      carregados: c.carregados,
      descarregados: c.descarregados,
      percentual,
      status: partida ? 'Em execução' : 'Aguardando partida',
    };
  });
  const ativos = equipes.filter((e) => e.status !== 'Sem giro');
  const totalBarras = soma(ativos, (e) => e.carregados);
  const descarregadas = soma(ativos, (e) => e.descarregados);
  return {
    ativos: ativos.length,
    totalBarras,
    descarregadas,
    progresso: totalBarras > 0 ? Math.round((descarregadas / totalBarras) * 100) : null,
    equipes,
  };
}
