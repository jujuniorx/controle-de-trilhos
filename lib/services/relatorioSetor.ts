import { prisma } from '@/lib/db';
import { METROS_POR_BARRA } from '@/lib/domain/informativo';
import { buscarMovimentacoesRelatorio, pesoMovimentacao } from '@/lib/services/relatorio';
import { CAMINHOES_ATIVOS } from '@/lib/services/usina';

/** Relatórios por setor: cada um sai como imagem (PNG) por ano inteiro ou por mês. */
export const SETORES = [
  { slug: 'patio', titulo: 'Pátio (movimentação)' },
  { slug: 'serra', titulo: 'Serra' },
  { slug: 'geracao', titulo: 'Geração de trilho' },
  { slug: 'estaleiro', titulo: 'Estaleiro de solda' },
  { slug: 'caminhoes', titulo: 'Caminhões de solda' },
  { slug: 'trilheiros', titulo: 'Trilheiros' },
] as const;

export type SetorSlug = (typeof SETORES)[number]['slug'];

export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function ehSetor(valor: string | undefined): valor is SetorSlug {
  return SETORES.some((s) => s.slug === valor);
}

export function nomeSetor(slug: SetorSlug): string {
  return SETORES.find((s) => s.slug === slug)?.titulo ?? slug;
}

/** Data de hoje em São Paulo, no formato AAAA-MM-DD. */
export function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export interface ColunaRelatorio {
  rotulo: string;
  casas: number;
  unidade: string;
}

export interface PeriodoRelatorio {
  ano: number;
  mes: number | null;
  inicio: string;
  fim: string;
  /** Verdadeiro quando o período ainda não acabou (ano ou mês em andamento). */
  parcial: boolean;
  rotulo: string;
}

export interface LinhaRelatorio {
  chave: string;
  rotulo: string;
  valores: number[];
}

export interface RelatorioSetor {
  slug: SetorSlug;
  titulo: string;
  periodo: PeriodoRelatorio;
  colunas: ColunaRelatorio[];
  totais: number[];
  linhas: LinhaRelatorio[];
  /** Colunas que compõem a primeira (total) e aparecem empilhadas no gráfico. Vazio = barra simples. */
  empilhar: number[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const br = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Lê ano e mês da URL. Ano fora do intervalo cai no ano atual; mês vazio ou inválido é o ano inteiro.
 * O fim do período nunca passa de hoje.
 */
export function periodoDoRelatorio(anoPedido: string | undefined, mesPedido: string | undefined, hoje: string): PeriodoRelatorio {
  const anoAtual = Number(hoje.slice(0, 4));
  const anoNum = Number(anoPedido);
  const ano = Number.isInteger(anoNum) && anoNum >= 2020 && anoNum <= anoAtual ? anoNum : anoAtual;
  const mesNum = Number(mesPedido);
  const mes = Number.isInteger(mesNum) && mesNum >= 1 && mesNum <= 12 ? mesNum : null;

  const inicio = `${ano}-${pad(mes ?? 1)}-01`;
  const ultimoDia = new Date(Date.UTC(ano, mes ?? 12, 0)).getUTCDate();
  const fimPrevisto = `${ano}-${pad(mes ?? 12)}-${pad(ultimoDia)}`;
  const fim = fimPrevisto < hoje ? fimPrevisto : hoje;
  const parcial = fim < fimPrevisto;
  const rotulo = mes
    ? `${MESES_LONGOS[mes - 1][0].toUpperCase()}${MESES_LONGOS[mes - 1].slice(1)} de ${ano}`
    : `Ano de ${ano}`;

  return { ano, mes, inicio, fim, parcial, rotulo: parcial ? `${rotulo} (até ${br(fim)})` : rotulo };
}

type Registro = { data: Date; valores: number[] };

interface DefinicaoSetor {
  colunas: ColunaRelatorio[];
  coletar: (inicio: string, fim: string) => Promise<Registro[]>;
  empilhar?: number[];
}

const faixa = (inicio: string, fim: string) => ({
  gte: new Date(`${inicio}T00:00:00Z`),
  lte: new Date(`${fim}T00:00:00Z`),
});

const DEFINICOES: Record<SetorSlug, DefinicaoSetor> = {
  patio: {
    colunas: [
      { rotulo: 'Movimentações', casas: 0, unidade: 'und' },
      { rotulo: 'Peças', casas: 0, unidade: 'pç' },
      { rotulo: 'Metros', casas: 1, unidade: 'm' },
      { rotulo: 'Toneladas', casas: 3, unidade: 't' },
    ],
    coletar: async (inicio, fim) => {
      const movs = await buscarMovimentacoesRelatorio({ dataInicio: inicio, dataFim: fim });
      return movs.map((mov) => {
        const pecas = mov.grupos.reduce((t, g) => t + g.medicoes.reduce((a, m) => a + m.quantidade, 0), 0);
        const metros = mov.grupos.reduce((t, g) => t + Number(g.metrosTotal), 0);
        return { data: mov.dataMovimentacao ?? mov.createdAt, valores: [1, pecas, metros, pesoMovimentacao(mov)] };
      });
    },
  },

  serra: {
    colunas: [
      { rotulo: 'Trilhos (barras)', casas: 0, unidade: 'und' },
      { rotulo: 'Metros', casas: 1, unidade: 'm' },
    ],
    coletar: async (inicio, fim) => {
      const linhas = await prisma.composicaoDia.findMany({
        where: { data: faixa(inicio, fim) },
        select: { data: true, barras: true },
      });
      return linhas.map((l) => {
        const barras = l.barras ?? 0;
        return { data: l.data, valores: [barras, barras * METROS_POR_BARRA] };
      });
    },
  },

  geracao: {
    colunas: [{ rotulo: 'Metros gerados', casas: 1, unidade: 'm' }],
    coletar: async (inicio, fim) => {
      const dias = await prisma.geracaoDia.findMany({
        where: { data: faixa(inicio, fim) },
        include: { carretas: true },
      });
      return dias.map((d) => ({
        data: d.data,
        valores: [d.carretas.reduce((t, c) => t + Number(c.carregamentoM ?? 0) + Number(c.deixadaViaM ?? 0), 0)],
      }));
    },
  },

  estaleiro: {
    colunas: [
      { rotulo: 'Soldas', casas: 0, unidade: 'und' },
      { rotulo: 'Cortes', casas: 0, unidade: 'und' },
    ],
    coletar: async (inicio, fim) => {
      const dias = await prisma.estaleiroDia.findMany({
        where: { data: faixa(inicio, fim) },
        select: { data: true, soldas: true, cortes: true },
      });
      return dias.map((d) => ({ data: d.data, valores: [d.soldas ?? 0, d.cortes ?? 0] }));
    },
  },

  caminhoes: {
    empilhar: [1, 2, 3],
    colunas: [
      { rotulo: 'Produção total', casas: 0, unidade: 'und' },
      ...CAMINHOES_ATIVOS.map((c) => ({ rotulo: c, casas: 0, unidade: 'und' })),
      ...CAMINHOES_ATIVOS.map((c) => ({ rotulo: `Perdas ${c}`, casas: 0, unidade: 'und' })),
      { rotulo: 'Perdas total', casas: 0, unidade: 'und' },
    ],
    coletar: async (inicio, fim) => {
      const linhas = await prisma.caminhaoSoldaDia.findMany({
        where: { data: faixa(inicio, fim) },
        select: { data: true, caminhao: true, producaoDiaria: true, perdaDiaria: true },
      });
      return linhas.map((l) => {
        const producao = l.producaoDiaria ?? 0;
        const perda = l.perdaDiaria ?? 0;
        const porCaminhao = CAMINHOES_ATIVOS.map((c) => (l.caminhao === c ? producao : 0));
        const perdaPorCaminhao = CAMINHOES_ATIVOS.map((c) => (l.caminhao === c ? perda : 0));
        return { data: l.data, valores: [producao, ...porCaminhao, ...perdaPorCaminhao, perda] };
      });
    },
  },

  trilheiros: {
    colunas: [
      { rotulo: 'Giros', casas: 0, unidade: 'und' },
      { rotulo: 'Carregados', casas: 0, unidade: 'und' },
      { rotulo: 'Descarregados', casas: 0, unidade: 'und' },
    ],
    coletar: async (inicio, fim) => {
      const giros = await prisma.trilheiroGiro.findMany({
        where: { boEm: faixa(inicio, fim) },
        select: { boEm: true, carregados: true, descarregados: true },
      });
      return giros
        .filter((g) => g.boEm)
        .map((g) => ({ data: g.boEm as Date, valores: [1, g.carregados, g.descarregados] }));
    },
  },
};

interface Balde {
  chave: string;
  rotulo: string;
}

/** Linhas da tabela: dias do mês quando um mês foi escolhido; meses do ano quando não. */
function listarBaldes(periodo: PeriodoRelatorio): Balde[] {
  if (periodo.fim < periodo.inicio) return [];
  if (periodo.mes) {
    const dias = Number(periodo.fim.slice(8));
    return Array.from({ length: dias }, (_, i) => ({ chave: pad(i + 1), rotulo: `${pad(i + 1)}/${pad(periodo.mes!)}` }));
  }
  const meses = Number(periodo.fim.slice(5, 7));
  return Array.from({ length: meses }, (_, i) => ({ chave: pad(i + 1), rotulo: MESES[i] }));
}

function arredondar(valor: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(valor * f) / f;
}

export async function montarRelatorioSetor(slug: SetorSlug, periodo: PeriodoRelatorio): Promise<RelatorioSetor> {
  const def = DEFINICOES[slug];
  const registros = periodo.fim < periodo.inicio ? [] : await def.coletar(periodo.inicio, periodo.fim);
  const baldes = listarBaldes(periodo);
  const linhas: LinhaRelatorio[] = baldes.map((b) => ({ chave: b.chave, rotulo: b.rotulo, valores: def.colunas.map(() => 0) }));
  const indice = new Map(linhas.map((l, i) => [l.chave, i]));
  const totais = def.colunas.map(() => 0);

  for (const r of registros) {
    const chave = periodo.mes ? pad(r.data.getUTCDate()) : pad(r.data.getUTCMonth() + 1);
    const i = indice.get(chave);
    r.valores.forEach((v, c) => {
      totais[c] += v;
      if (i !== undefined) linhas[i].valores[c] += v;
    });
  }

  return {
    slug,
    titulo: nomeSetor(slug),
    empilhar: def.empilhar ?? [],
    periodo,
    colunas: def.colunas,
    totais: totais.map((v, c) => arredondar(v, def.colunas[c].casas)),
    linhas: linhas.map((l) => ({ ...l, valores: l.valores.map((v, c) => arredondar(v, def.colunas[c].casas)) })),
  };
}
