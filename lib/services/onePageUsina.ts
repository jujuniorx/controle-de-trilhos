import {
  estaleiroDoPeriodo,
  geracaoDoPeriodo,
  caminhoesDoPeriodo,
  TRILHEIROS,
  BARRAS_POR_TRILHEIRO,
  COMPOSICOES,
  rotuloComposicao,
} from '@/lib/services/usina';
import { seriesDaSemana } from '@/lib/services/usinaGraficos';
import { prisma } from '@/lib/db';
import { intervaloDoPeriodo } from '@/lib/usina/periodo';
import { observacoesDoPeriodo } from '@/lib/services/observacaoSetor';
import { somarDias } from '@/lib/usina/diasUteis';
import { METROS_POR_BARRA } from '@/lib/domain/informativo';
import { fmtMetros, fmtPeso } from '@/lib/format';

const soma = <T,>(lista: T[], f: (x: T) => number) => lista.reduce((a, x) => a + f(x), 0);
const metros = (v: number) => `${fmtMetros(v)} m`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Valores de cada dia da semana (segunda a domingo), quando existem; usados no PDF diário. */
/** cores: uma cor por parte do valor separada por ' / ' (ex.: W61 e W62), para cada parte aparecer na cor da sua composição. */
export interface LinhaRelatorio { rotulo: string; dia: string; semana: string; mes: string; porDia?: string[]; cores?: string[] }
export interface GraficoRelatorio { titulo: string; series: { nome: string; cor: string; valores: number[] }[] }
/** Grade de produção por dia (um valor por dia da semana), para setores em que o número do dia importa mais que o gráfico. */
export interface GradeRelatorio { colunas: string[]; linhas: { rotulo: string; valores: number[] }[] }
/** Barras e metros de uma medida (dia, semana ou mês). */
export interface MedidaSerra { barras: number; metros: number }
/** Uma composição da serra (W61, W62): barras e metros em cada período. */
export interface LinhaSerra { ativo: string; cor: string; dia: MedidaSerra; semana: MedidaSerra; mes: MedidaSerra }
/** Tabela da serra: uma linha por composição e um total, com Dia, Semana e Mês (barras e metros). */
export interface SerraRelatorio { linhas: LinhaSerra[]; total: { dia: MedidaSerra; semana: MedidaSerra; mes: MedidaSerra } }
export interface SetorRelatorio { titulo: string; cor: string; linhas: LinhaRelatorio[]; grafico: GraficoRelatorio | null; grade?: GradeRelatorio; serra?: SerraRelatorio }

/** Produção de uma equipe de geração: o dia e a semana. */
export interface EquipeGeracaoRelatorio {
  rotulo: string;
  dia: { corteM: number; carregamentoM: number; deixadaViaM: number; quantidade: number };
  semana: { corteM: number; carregamentoM: number; deixadaViaM: number; quantidade: number };
}

export interface DadosRelatorio {
  data: string;
  rotulosDias: string[];
  resumo: { rotulo: string; cor: string; dia: string; semana: string; mes: string; grupo: string }[];
  setores: SetorRelatorio[];
  equipesGeracao: EquipeGeracaoRelatorio[];
  /** Observação de cada setor por dia, da segunda a domingo da semana: chave "AAAA-MM-DD|setor". */
  observacoes: Record<string, string>;
}

/** Cores fixas por setor (cabeçalho) e uma cor distinta para cada série dentro do setor. */
export const CORES_SETOR = { estaleiro: '#2563eb', geracao: '#059669', serra: '#be123c', caminhao: '#ea580c', trilheiros: '#0891b2' };

/** Nome de cada caminhão de solda no relatório: equipe / caminhão, como na escala. */
export const ROTULO_CAMINHAO: Record<string, string> = { CW01: 'E17 / CW01', CW02: 'E18 / CW02' };

/** Mesmos números do relatório gerencial da usina, em forma simples para a tela e para o PDF. */
export async function montarDadosRelatorio(data: string): Promise<DadosRelatorio> {
  const serie = await seriesDaSemana(data);
  const { inicio, fim } = intervaloDoPeriodo('semana', data);
  const mes = intervaloDoPeriodo('mes', data);
  const dias = serie.rotulos.length;

  const trilRel = await montarTrilheirosRelatorio(data);
  const [estD, estS, estM, gerD, gerS, camD, camS, serraSem, serraMesRows] = await Promise.all([
    estaleiroDoPeriodo('dia', data),
    estaleiroDoPeriodo('semana', data),
    estaleiroDoPeriodo('mes', data),
    geracaoDoPeriodo('dia', data),
    geracaoDoPeriodo('semana', data),
    caminhoesDoPeriodo('dia', data),
    caminhoesDoPeriodo('semana', data),
    prisma.composicaoDia.findMany({
      where: { data: { gte: new Date(`${inicio}T00:00:00Z`), lte: new Date(`${fim}T00:00:00Z`) } },
      select: { data: true, ativo: true, barras: true },
    }),
    prisma.composicaoDia.findMany({
      where: { data: { gte: new Date(`${mes.inicio}T00:00:00Z`), lte: new Date(`${data}T00:00:00Z`) } },
      select: { data: true, ativo: true, barras: true },
    }),
  ]);

  // Serra (modelo do informativo): barras de W61 e W62 × 10,5 m, estimativa em metros.
  const barrasDia = (ativo: string) => serraSem.filter((r) => r.ativo === ativo && iso(r.data) === data).reduce((t, r) => t + (r.barras ?? 0), 0);
  const barrasSemana = (ativo: string) => serraSem.filter((r) => r.ativo === ativo).reduce((t, r) => t + (r.barras ?? 0), 0);
  const barrasMes = (ativo: string) => serraMesRows.filter((r) => r.ativo === ativo).reduce((t, r) => t + (r.barras ?? 0), 0);
  const metrosDeBarras = (b: number) => Math.round(b * METROS_POR_BARRA * 100) / 100;
  const serraDiaSerie = (ativo: string) => {
    const valores = new Array<number>(dias).fill(0);
    for (const r of serraSem) {
      const i = Math.round((Date.parse(`${iso(r.data)}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000);
      if (r.ativo === ativo && i >= 0 && i < dias) valores[i] += metrosDeBarras(r.barras ?? 0);
    }
    return valores;
  };
  // Cor de cada composição da serra: a mesma usada no gráfico (W61 roxo, W62 âmbar).
  const COR_COMPOSICAO = COMPOSICOES.map((_, i) => (i === 0 ? '#7c3aed' : '#f59e0b'));
  const serraTotalDia = COMPOSICOES.reduce((t, a) => t + metrosDeBarras(barrasDia(a)), 0);
  const serraTotalSemana = COMPOSICOES.reduce((t, a) => t + metrosDeBarras(barrasSemana(a)), 0);
  const serraTotalMes = COMPOSICOES.reduce((t, a) => t + metrosDeBarras(barrasMes(a)), 0);

  const geraDia = (f: (l: (typeof gerD.porLider)[number]) => number) => soma(gerD.porLider, f);
  const geraSem = (f: (l: (typeof gerS.porLider)[number]) => number) => soma(gerS.porLider, f);

  const observacoes = await observacoesDoPeriodo(inicio, somarDias(inicio, 6));

  return {
    data,
    observacoes,
    rotulosDias: serie.rotulos,
    equipesGeracao: gerS.porLider.map((l) => {
      const d = gerD.porLider.find((x) => x.valor === l.valor)?.periodo;
      return {
        rotulo: l.rotulo,
        dia: { corteM: d?.corteM ?? 0, carregamentoM: d?.carregamentoM ?? 0, deixadaViaM: d?.deixadaViaM ?? 0, quantidade: d?.quantidade ?? 0 },
        semana: { corteM: l.periodo.corteM, carregamentoM: l.periodo.carregamentoM, deixadaViaM: l.periodo.deixadaViaM, quantidade: l.periodo.quantidade },
      };
    }),
    resumo: [
      {
        rotulo: 'Estaleiro de solda',
        cor: CORES_SETOR.estaleiro,
        dia: `${estD.totais.soldas} UND`,
        semana: `${estS.totais.soldas} UND`,
        mes: `${estM.totais.soldas} UND`,
        grupo: 'Estaleiro de solda',
      },
      {
        rotulo: 'Geração de trilho',
        cor: CORES_SETOR.geracao,
        dia: metros(geraDia((l) => l.periodo.carregamentoM + l.periodo.deixadaViaM)),
        semana: metros(geraSem((l) => l.periodo.carregamentoM + l.periodo.deixadaViaM)),
        mes: metros(geraSem((l) => l.mes.carregamentoM + l.mes.deixadaViaM)),
        grupo: 'Geração de trilho',
      },
      {
        rotulo: 'Serra (estimado)',
        cor: CORES_SETOR.serra,
        dia: metros(serraTotalDia),
        semana: metros(serraTotalSemana),
        mes: metros(serraTotalMes),
        grupo: 'Recolhimento serra',
      },
      ...['CW01', 'CW02'].map((cw, i) => ({
        rotulo: ROTULO_CAMINHAO[cw] ?? cw,
        cor: i === 0 ? CORES_SETOR.caminhao : '#84cc16',
        dia: `${camD.find((c) => c.caminhao === cw)?.periodo.producao ?? 0} UND`,
        semana: `${camS.find((c) => c.caminhao === cw)?.periodo.producao ?? 0} UND`,
        mes: `${camS.find((c) => c.caminhao === cw)?.mes.producao ?? 0} UND`,
        grupo: 'Caminhão de solda',
      })),
      {
        rotulo: 'Trilheiros',
        cor: CORES_SETOR.trilheiros,
        dia: `${soma(trilRel.equipes, (e) => e.descarregadasDia)} barras`,
        semana: `${trilRel.descarregadas} de ${trilRel.totalBarras}`,
        mes: `${trilRel.descarregadasMes} barras`,
        grupo: 'Trilheiros',
      },
    ],
    setores: [
      {
        titulo: 'Estaleiro de solda',
        cor: CORES_SETOR.estaleiro,
        linhas: [
          { rotulo: 'Soldas (UND)', dia: String(estD.totais.soldas), semana: String(estS.totais.soldas), mes: String(estM.totais.soldas), porDia: serie.estaleiro.soldas.map(String) },
          { rotulo: 'Cortes (UND)', dia: String(estD.totais.cortes), semana: String(estS.totais.cortes), mes: String(estM.totais.cortes), porDia: serie.estaleiro.cortes.map(String) },
          { rotulo: 'Tampões (m)', dia: metros(estD.carreta.tampoesM), semana: metros(estS.carreta.tampoesM), mes: metros(estM.carreta.tampoesM) },
          { rotulo: 'Trilho novo (m)', dia: metros(estD.carreta.trilhoNovoM), semana: metros(estS.carreta.trilhoNovoM), mes: metros(estM.carreta.trilhoNovoM) },
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
          { rotulo: 'Carregado (m)', dia: metros(geraDia((l) => l.periodo.carregamentoM)), semana: metros(geraSem((l) => l.periodo.carregamentoM)), mes: metros(geraSem((l) => l.mes.carregamentoM)), porDia: serie.geracao.carregado.map((v) => fmtMetros(v)) },
          { rotulo: 'Na via (m)', dia: metros(geraDia((l) => l.periodo.deixadaViaM)), semana: metros(geraSem((l) => l.periodo.deixadaViaM)), mes: metros(geraSem((l) => l.mes.deixadaViaM)), porDia: serie.geracao.deixado.map((v) => fmtMetros(v)) },
          { rotulo: 'Barras (UND)', dia: String(geraDia((l) => l.periodo.quantidade)), semana: String(geraSem((l) => l.periodo.quantidade)), mes: String(geraSem((l) => l.mes.quantidade)) },
        ],
        grafico: {
          titulo: 'Metros por dia',
          series: [
            { nome: 'Carregado', cor: '#059669', valores: serie.geracao.carregado },
            { nome: 'Deixado na via', cor: '#db2777', valores: serie.geracao.deixado },
          ],
        },
      },
      {
        titulo: 'Recolhimento serra',
        cor: CORES_SETOR.serra,
        serra: {
          linhas: COMPOSICOES.map((a, i) => ({
            ativo: a,
            cor: i === 0 ? '#7c3aed' : '#f59e0b',
            dia: { barras: barrasDia(a), metros: metrosDeBarras(barrasDia(a)) },
            semana: { barras: barrasSemana(a), metros: metrosDeBarras(barrasSemana(a)) },
            mes: { barras: barrasMes(a), metros: metrosDeBarras(barrasMes(a)) },
          })),
          total: {
            dia: { barras: COMPOSICOES.reduce((t, a) => t + barrasDia(a), 0), metros: serraTotalDia },
            semana: { barras: COMPOSICOES.reduce((t, a) => t + barrasSemana(a), 0), metros: serraTotalSemana },
            mes: { barras: COMPOSICOES.reduce((t, a) => t + barrasMes(a), 0), metros: serraTotalMes },
          },
        },
        linhas: [
          // Uma linha por medida, com as composições na mesma célula (W61 / W62): a tabela não cresce com novas composições.
          { rotulo: `Barras (${COMPOSICOES.join(' e ')}), nessa ordem`, dia: COMPOSICOES.map((a) => barrasDia(a)).join(' / '), semana: COMPOSICOES.map((a) => barrasSemana(a)).join(' / '), mes: COMPOSICOES.map((a) => barrasMes(a)).join(' / '), porDia: Array.from({ length: dias }, (_, i) => COMPOSICOES.map((a) => serraDiaSerie(a)[i] ? Math.round(serraDiaSerie(a)[i]! / METROS_POR_BARRA) : 0).join(' / ')), cores: COR_COMPOSICAO },
          { rotulo: `Metros estimados (${COMPOSICOES.join(' e ')}), nessa ordem`, dia: COMPOSICOES.map((a) => fmtMetros(metrosDeBarras(barrasDia(a)))).join(' / '), semana: COMPOSICOES.map((a) => fmtMetros(metrosDeBarras(barrasSemana(a)))).join(' / '), mes: COMPOSICOES.map((a) => fmtMetros(metrosDeBarras(barrasMes(a)))).join(' / '), porDia: Array.from({ length: dias }, (_, i) => COMPOSICOES.map((a) => fmtMetros(serraDiaSerie(a)[i] ?? 0)).join(' / ')), cores: COR_COMPOSICAO },
          { rotulo: 'Total estimado (m)', dia: metros(serraTotalDia), semana: metros(serraTotalSemana), mes: metros(serraTotalMes) },
        ],
        grafico: {
          titulo: 'Metros por dia: W61 e W62 (barras × 10,5 m)',
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
        // Mesmo formato do estaleiro: Solda (UND) e Corte (UND) por caminhão, com Dia, Semana e No mês.
        linhas: camS.flatMap((c) => {
          const d = camD.find((x) => x.caminhao === c.caminhao);
          const nome = ROTULO_CAMINHAO[c.caminhao] ?? c.caminhao;
          return [
            {
              rotulo: `${nome} · Solda (UND)`,
              dia: String(d?.periodo.producao ?? 0),
              semana: String(c.periodo.producao),
              mes: String(c.mes.producao),
              porDia: ((serie.caminhao as Record<string, number[]>)[c.caminhao] ?? []).map(String),
            },
            {
              rotulo: `${nome} · Corte (UND)`,
              dia: String(d?.periodo.perda ?? 0),
              semana: String(c.periodo.perda),
              mes: String(c.mes.perda),
            },
          ];
        }),
        grade: {
          colunas: serie.rotulos,
          linhas: [
            { rotulo: ROTULO_CAMINHAO.CW01, valores: serie.caminhao.CW01 ?? [] },
            { rotulo: ROTULO_CAMINHAO.CW02, valores: serie.caminhao.CW02 ?? [] },
          ],
        },
        grafico: {
          titulo: 'Solda por dia',
          series: [
            { nome: ROTULO_CAMINHAO.CW01, cor: '#ea580c', valores: serie.caminhao.CW01 ?? [] },
            { nome: ROTULO_CAMINHAO.CW02, cor: '#84cc16', valores: serie.caminhao.CW02 ?? [] },
          ],
        },
      },
      {
        titulo: 'Trilheiros',
        cor: CORES_SETOR.trilheiros,
        linhas: trilRel.equipes.map((e) => ({
          rotulo: `${e.trilheiro} · B.O. ${brDaIso(e.bo)} (${e.giroDias ?? '—'} dias) · Partida ${brDaIso(e.partida)} (${e.diasDesdePartida ?? '—'} dias) · ${e.local ?? '—'}`,
          dia: `+${e.descarregadasDia}`,
          semana: `${e.descarregadas} / ${e.total}`,
          mes: '—',
        })),
        grafico: null,
      },
    ],
  };
}

export interface EquipeTrilheiro {
  trilheiro: string;
  /** Dias corridos desde o B.O. até a data do relatório. */
  giroDias: number | null;
  bo: string | null;
  /** Data em que o trilheiro saiu da usina. */
  partida: string | null;
  /** Dias corridos desde a partida até a data do relatório. */
  diasDesdePartida: number | null;
  local: string | null;
  observacao: string | null;
  total: number;
  descarregadas: number;
  descarregadasDia: number;
  status: string;
}

/** AAAA-MM-DD para DD/MM/AAAA (ou traço, se vazio). */
function brDaIso(iso: string | null): string {
  return iso ? iso.split('-').reverse().join('/') : '—';
}

export interface TrilheirosRelatorio {
  ativos: number;
  totalBarras: number;
  descarregadas: number;
  progresso: number | null;
  /** Barras descarregadas no mês corrente até a data do relatório (soma dos dias de cada giro). */
  descarregadasMes: number;
  equipes: EquipeTrilheiro[];
}

/** Barras descarregadas por trilheiro do dia 1 do mês até a data, somando o que saiu em cada dia do giro. */
async function descarregadasNoMes(data: string): Promise<number> {
  const inicioMes = `${data.slice(0, 8)}01`;
  const totais = await Promise.all(
    TRILHEIROS.map(async (t) => {
      const [antes, dias] = await Promise.all([
        prisma.trilheiroDia.findFirst({
          where: { trilheiro: t, data: { lt: new Date(`${inicioMes}T00:00:00Z`) }, descarregadas: { not: null } },
          orderBy: { data: 'desc' },
        }),
        prisma.trilheiroDia.findMany({
          where: { trilheiro: t, data: { gte: new Date(`${inicioMes}T00:00:00Z`), lte: new Date(`${data}T00:00:00Z`) }, descarregadas: { not: null } },
          orderBy: { data: 'asc' },
        }),
      ]);
      let anterior = antes;
      let soma = 0;
      for (const r of dias) {
        const base = anterior && anterior.boEm?.getTime() === r.boEm?.getTime() ? anterior.descarregadas ?? 0 : 0;
        soma += Math.max(0, (r.descarregadas ?? 0) - base);
        anterior = r;
      }
      return soma;
    }),
  );
  return totais.reduce((a, b) => a + b, 0);
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
        return {
          trilheiro: t,
          giroDias: null,
          bo: null,
          partida: null,
          diasDesdePartida: null,
          local: null,
          observacao: null,
          total: 0,
          descarregadas: 0,
          descarregadasDia: 0,
          status: 'Sem lançamento',
        };
      }
      const bo = r.boEm ? r.boEm.toISOString().slice(0, 10) : null;
      const giroDias = bo ? Math.round((diaMs(data) - diaMs(bo)) / 86400000) : null;
      const partida = r.partidaEm ? r.partidaEm.toISOString().slice(0, 10) : null;
      const diasDesdePartida = partida ? Math.round((diaMs(data) - diaMs(partida)) / 86400000) : null;
      const descarregadas = r.descarregadas ?? 0;
      const baseDoGiro = anterior && anterior.boEm?.getTime() === r.boEm?.getTime() ? anterior.descarregadas ?? 0 : 0;
      const total = r.total ?? BARRAS_POR_TRILHEIRO;
      return {
        trilheiro: t,
        giroDias,
        bo,
        partida,
        diasDesdePartida,
        local: r.local ?? null,
        observacao: r.observacao ?? null,
        total,
        descarregadas,
        // "Do dia" só vale se houve lançamento na própria data do relatório; senão mostra zero, e não o último dia lançado.
        descarregadasDia: r.data.toISOString().slice(0, 10) === data ? Math.max(0, descarregadas - baseDoGiro) : 0,
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
    descarregadasMes: await descarregadasNoMes(data),
    equipes,
  };
}
