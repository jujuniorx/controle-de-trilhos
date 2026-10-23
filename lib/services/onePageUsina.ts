import {
  estaleiroDoPeriodo,
  geracaoDoPeriodo,
  caminhoesDoPeriodo,
  trilheirosDoPeriodo,
  TRILHEIROS,
  BARRAS_POR_TRILHEIRO,
  COMPOSICOES,
  rotuloComposicao,
} from '@/lib/services/usina';
import { seriesDaSemana } from '@/lib/services/usinaGraficos';
import { prisma } from '@/lib/db';
import { intervaloDoPeriodo } from '@/lib/usina/periodo';
import { METROS_POR_BARRA } from '@/lib/domain/informativo';
import { fmtMetros, fmtPeso } from '@/lib/format';

const soma = <T,>(lista: T[], f: (x: T) => number) => lista.reduce((a, x) => a + f(x), 0);
const metros = (v: number) => `${fmtMetros(v)} m`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export interface LinhaRelatorio { rotulo: string; dia: string; mes: string }
export interface GraficoRelatorio { titulo: string; series: { nome: string; cor: string; valores: number[] }[] }
export interface SetorRelatorio { titulo: string; cor: string; linhas: LinhaRelatorio[]; grafico: GraficoRelatorio | null }

/** Produção de uma equipe de geração: o dia e a semana. */
export interface EquipeGeracaoRelatorio {
  rotulo: string;
  dia: { corteM: number; carregamentoM: number; deixadaViaM: number; quantidade: number };
  semana: { corteM: number; carregamentoM: number; deixadaViaM: number; quantidade: number };
}

export interface DadosRelatorio {
  data: string;
  rotulosDias: string[];
  resumo: { rotulo: string; cor: string; dia: string; mes: string; grupo: string }[];
  setores: SetorRelatorio[];
  equipesGeracao: EquipeGeracaoRelatorio[];
}

/** Cores fixas por setor (cabeçalho) e uma cor distinta para cada série dentro do setor. */
export const CORES_SETOR = { estaleiro: '#2563eb', geracao: '#059669', serra: '#be123c', caminhao: '#ea580c', trilheiros: '#0891b2' };

/** Mesmos números do relatório gerencial da usina, em forma simples para a tela e para o PDF. */
export async function montarDadosRelatorio(data: string): Promise<DadosRelatorio> {
  const serie = await seriesDaSemana(data);
  const { inicio, fim } = intervaloDoPeriodo('semana', data);
  const dias = serie.rotulos.length;

  const trilRel = await montarTrilheirosRelatorio(data);
  const [estD, estM, gerD, gerM, camD, camM, trilD, trilM, serraMes] = await Promise.all([
    estaleiroDoPeriodo('dia', data),
    estaleiroDoPeriodo('semana', data),
    geracaoDoPeriodo('dia', data),
    geracaoDoPeriodo('semana', data),
    caminhoesDoPeriodo('dia', data),
    caminhoesDoPeriodo('semana', data),
    trilheirosDoPeriodo('dia', data),
    trilheirosDoPeriodo('semana', data),
    prisma.composicaoDia.findMany({
      where: { data: { gte: new Date(`${inicio}T00:00:00Z`), lte: new Date(`${fim}T00:00:00Z`) } },
      select: { data: true, ativo: true, barras: true },
    }),
  ]);

  // Serra (modelo do informativo): barras de W61 e W62 × 10,5 m, estimativa em metros.
  const barrasDia = (ativo: string) => serraMes.filter((r) => r.ativo === ativo && iso(r.data) === data).reduce((t, r) => t + (r.barras ?? 0), 0);
  const barrasSemana = (ativo: string) => serraMes.filter((r) => r.ativo === ativo).reduce((t, r) => t + (r.barras ?? 0), 0);
  const metrosDeBarras = (b: number) => Math.round(b * METROS_POR_BARRA * 100) / 100;
  const serraDiaSerie = (ativo: string) => {
    const valores = new Array<number>(dias).fill(0);
    for (const r of serraMes) {
      const i = Math.round((Date.parse(`${iso(r.data)}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000);
      if (r.ativo === ativo && i >= 0 && i < dias) valores[i] += metrosDeBarras(r.barras ?? 0);
    }
    return valores;
  };
  const serraTotalDia = COMPOSICOES.reduce((t, a) => t + metrosDeBarras(barrasDia(a)), 0);
  const serraTotalMes = COMPOSICOES.reduce((t, a) => t + metrosDeBarras(barrasSemana(a)), 0);

  const geraDia = (f: (l: (typeof gerD.porLider)[number]) => number) => soma(gerD.porLider, f);
  const geraMes = (f: (l: (typeof gerM.porLider)[number]) => number) => soma(gerM.porLider, f);

  return {
    data,
    rotulosDias: serie.rotulos,
    equipesGeracao: gerM.porLider.map((l) => {
      const d = gerD.porLider.find((x) => x.valor === l.valor)?.periodo;
      return {
        rotulo: l.rotulo,
        dia: { corteM: d?.corteM ?? 0, carregamentoM: d?.carregamentoM ?? 0, deixadaViaM: d?.deixadaViaM ?? 0, quantidade: d?.quantidade ?? 0 },
        semana: { corteM: l.periodo.corteM, carregamentoM: l.periodo.carregamentoM, deixadaViaM: l.periodo.deixadaViaM, quantidade: l.periodo.quantidade },
      };
    }),
    resumo: [
      { rotulo: 'Estaleiro de solda', cor: CORES_SETOR.estaleiro, dia: `${estD.totais.soldas} UND`, mes: `${estM.totais.soldas} UND`, grupo: 'Estaleiro de solda' },
      {
        rotulo: 'Geração de trilho',
        cor: CORES_SETOR.geracao,
        dia: metros(geraDia((l) => l.periodo.carregamentoM + l.periodo.deixadaViaM)),
        mes: metros(geraMes((l) => l.mes.carregamentoM + l.mes.deixadaViaM)),
        grupo: 'Geração de trilho',
      },
      { rotulo: 'Serra (estimado)', cor: CORES_SETOR.serra, dia: metros(serraTotalDia), mes: metros(serraTotalMes), grupo: 'Recolhimento serra' },
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
        dia: String(soma(trilRel.equipes, (e) => e.descarregadasDia)),
        mes: `${trilRel.descarregadas}/${trilRel.totalBarras}`,
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
          ...COMPOSICOES.flatMap((a) => [
            { rotulo: `${rotuloComposicao(a)} · barras`, dia: String(barrasDia(a)), mes: String(barrasSemana(a)) },
            { rotulo: `${a} · metros estimados`, dia: metros(metrosDeBarras(barrasDia(a))), mes: metros(metrosDeBarras(barrasSemana(a))) },
          ]),
          { rotulo: 'Total estimado (m)', dia: metros(serraTotalDia), mes: metros(serraTotalMes) },
        ],
        grafico: {
          titulo: 'Metros estimados por dia (barras × 10,5)',
          series: COMPOSICOES.map((a, i) => ({
            nome: a,
            cor: i === 0 ? '#7c3aed' : '#f59e0b',
            valores: serraDiaSerie(a),
          })),
        },
      },
      {
        titulo: 'Caminhão de solda',
        cor: CORES_SETOR.caminhao,
        linhas: camM.flatMap((c) => {
          const d = camD.find((x) => x.caminhao === c.caminhao);
          return [
            { rotulo: `${c.caminhao} · produção (UND)`, dia: String(d?.periodo.producao ?? 0), mes: String(c.mes.producao) },
            { rotulo: `${c.caminhao} · perda (UND)`, dia: String(d?.periodo.perda ?? 0), mes: String(c.mes.perda) },
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
        cor: CORES_SETOR.trilheiros,
        linhas: trilRel.equipes.flatMap((e) => [
          { rotulo: `${e.trilheiro} · barras descarregadas`, dia: `${e.descarregadasDia}`, mes: `${e.descarregadas} / ${e.total}` },
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
  bo: string | null;
  total: number;
  descarregadas: number;
  descarregadasDia: number;
  percentual: number | null;
  programacao: string | null;
  status: string;
}

export interface TrilheirosRelatorio {
  ativos: number;
  totalBarras: number;
  descarregadas: number;
  progresso: number | null;
  equipes: EquipeTrilheiro[];
}

/** Situacao de cada trilheiro no dia: ultimo lancamento da tabela diaria ate a data do relatorio. */
export async function montarTrilheirosRelatorio(data: string): Promise<TrilheirosRelatorio> {
  const diaMs = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const equipes: EquipeTrilheiro[] = await Promise.all(
    TRILHEIROS.map(async (t) => {
      const dataRel = new Date(`${data}T00:00:00Z`);
      // Ultimo dia lançado (com barras) ate a data do relatorio.
      const r = await prisma.trilheiroDia.findFirst({
        where: { trilheiro: t, data: { lte: dataRel }, descarregadas: { not: null } },
        orderBy: { data: 'desc' },
      });
      // Dia anterior do mesmo giro: a diferenca entre os dois e o que foi descarregado no dia.
      const anterior = r
        ? await prisma.trilheiroDia.findFirst({
            where: { trilheiro: t, data: { lt: r.data }, descarregadas: { not: null } },
            orderBy: { data: 'desc' },
          })
        : null;
      if (!r) {
        return { trilheiro: t, giroDias: null, bo: null, total: 0, descarregadas: 0, descarregadasDia: 0, percentual: null, programacao: null, status: 'Sem lançamento' };
      }
      const bo = r.boEm ? r.boEm.toISOString().slice(0, 10) : null;
      const giroDias = bo ? Math.round((diaMs(data) - diaMs(bo)) / 86400000) : null;
      const descarregadas = r.descarregadas ?? 0;
      const baseDoGiro = anterior && anterior.boEm?.getTime() === r.boEm?.getTime() ? anterior.descarregadas ?? 0 : 0;
      const total = r.total ?? BARRAS_POR_TRILHEIRO;
      return {
        trilheiro: t,
        giroDias,
        bo,
        total,
        descarregadas,
        descarregadasDia: Math.max(0, descarregadas - baseDoGiro),
        percentual: total > 0 ? Math.round((descarregadas / total) * 100) : null,
        programacao: r.programacao,
        status: 'Em execução',
      };
    }),
  );
  const ativos = equipes.filter((e) => e.status !== 'Sem lançamento');
  const totalBarras = soma(ativos, (e) => e.total);
  const descarregadas = soma(ativos, (e) => e.descarregadas);
  return {
    ativos: ativos.length,
    totalBarras,
    descarregadas,
    progresso: totalBarras > 0 ? Math.round((descarregadas / totalBarras) * 100) : null,
    equipes,
  };
}
