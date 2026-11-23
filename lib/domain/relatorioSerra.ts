/**
 * Relatório da serra ("Trilhos 2026"): o recolhido por mês das composições W61 e W62, em barras, com a meta de
 * recolhimento, o recolhido em metros (barras × 10,5) e o pendente (meta − recolhido). Puro, sem banco: recebe as
 * linhas da composição diária (ComposicaoDia) e a data de corte ("atualizado em").
 */
import { META_RECOLHIMENTO_M, METROS_POR_BARRA } from '@/lib/domain/informativo';

export type Composicao = 'W61' | 'W62';
export interface LinhaComposicao { data: string; ativo: Composicao; barras: number | null }

/**
 * Meses que não estão no sistema e vêm do relatório anterior (o primeiro "Trilhos 2026" enviado ao gerente).
 * Só entram quando o mês não tem nenhum lançamento com barras para aquela composição.
 */
export const BASE_RELATORIO_ANTERIOR: { mes: string; ativo: Composicao; barras: number }[] = [
  { mes: '2026-09', ativo: 'W61', barras: 448 },
];

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export interface MesSerra { mes: string; rotulo: string; w61: number; w62: number }

export interface RelatorioSerra {
  ano: number;
  ate: string; // AAAA-MM-DD
  meses: MesSerra[];
  totalBarras: { w61: number; w62: number };
  metros: { w61: number; w62: number; total: number };
  metaM: number;
  pendenteM: number;
  percentualMeta: number; // 0..100
  periodo: { w61: string; w62: string }; // ex.: "AGO A NOV", "OUT E NOV"
  usouBase: boolean;
  parcialAte: string | null; // "novembro até 13/11" quando o último mês ainda não fechou
}

const fmtDiaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function ultimoDiaDoMes(ano: number, mes0: number): number {
  return new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();
}

/** "AGO A NOV", "OUT E NOV" ou só "NOV", a partir dos meses que têm barras. */
export function periodoDosMeses(meses: string[]): string {
  if (meses.length === 0) return '';
  const r = (m: string) => MESES_CURTOS[Number(m.slice(5, 7)) - 1].toUpperCase();
  if (meses.length === 1) return r(meses[0]);
  if (meses.length === 2) return `${r(meses[0])} E ${r(meses[1])}`;
  return `${r(meses[0])} A ${r(meses[meses.length - 1])}`;
}

export function montarRelatorioSerra(linhas: LinhaComposicao[], ate: string, base = BASE_RELATORIO_ANTERIOR): RelatorioSerra {
  const ano = Number(ate.slice(0, 4));
  const mesAte = ate.slice(0, 7);
  // soma por mês e composição, só até a data de corte; `tem` marca onde houve algum lançamento com barras
  const soma = new Map<string, number>();
  const tem = new Set<string>();
  for (const l of linhas) {
    if (!l.data.startsWith(String(ano)) || l.data > ate || l.barras == null) continue;
    const k = `${l.data.slice(0, 7)}|${l.ativo}`;
    soma.set(k, (soma.get(k) ?? 0) + l.barras);
    tem.add(k);
  }
  let usouBase = false;
  for (const b of base) {
    const k = `${b.mes}|${b.ativo}`;
    if (!b.mes.startsWith(String(ano)) || b.mes > mesAte || tem.has(k)) continue;
    soma.set(k, b.barras);
    usouBase = true;
  }
  const valor = (mes: string, a: Composicao) => soma.get(`${mes}|${a}`) ?? 0;

  // do primeiro mês com barras até o mês da data de corte
  const todos = Array.from({ length: Number(mesAte.slice(5, 7)) }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}`);
  const primeiro = todos.findIndex((m) => valor(m, 'W61') > 0 || valor(m, 'W62') > 0);
  const lista = primeiro < 0 ? [] : todos.slice(primeiro);
  const meses = lista.map((mes) => ({ mes, rotulo: MESES_CURTOS[Number(mes.slice(5, 7)) - 1], w61: valor(mes, 'W61'), w62: valor(mes, 'W62') }));

  const totalBarras = { w61: meses.reduce((t, m) => t + m.w61, 0), w62: meses.reduce((t, m) => t + m.w62, 0) };
  const metros = { w61: totalBarras.w61 * METROS_POR_BARRA, w62: totalBarras.w62 * METROS_POR_BARRA, total: 0 };
  metros.total = metros.w61 + metros.w62;
  const mes0 = Number(mesAte.slice(5, 7)) - 1;
  const fechou = Number(ate.slice(8, 10)) >= ultimoDiaDoMes(ano, mes0);
  return {
    ano,
    ate,
    meses,
    totalBarras,
    metros,
    metaM: META_RECOLHIMENTO_M,
    pendenteM: Math.max(META_RECOLHIMENTO_M - metros.total, 0),
    percentualMeta: (metros.total / META_RECOLHIMENTO_M) * 100,
    periodo: {
      w61: periodoDosMeses(meses.filter((m) => m.w61 > 0).map((m) => m.mes)),
      w62: periodoDosMeses(meses.filter((m) => m.w62 > 0).map((m) => m.mes)),
    },
    usouBase,
    parcialAte: meses.length > 0 && !fechou ? `${MESES_LONGOS[mes0]} até ${fmtDiaMes(ate)}` : null,
  };
}

/** Teto e passo do eixo: poucas marcas e espaço acima da barra mais alta (600 / 100 para ~500 barras). */
export function eixoSerra(topo: number): { max: number; passo: number } {
  const alvo = Math.max(topo * 1.08, 1);
  for (const passo of [10, 20, 50, 100, 200, 500, 1000]) if (alvo / passo <= 6) return { max: Math.ceil(alvo / passo) * passo, passo };
  return { max: Math.ceil(alvo / 1000) * 1000, passo: 1000 };
}
