import { METROS_POR_BARRA } from '@/lib/domain/informativo';
import type { Quadro } from '@/lib/services/informativo';

/** Unidade do eixo: barras (W61/W62 nativos) ou metros (W61/W62 × 10,5). */
export type Unidade = 'barras' | 'metros';
export const UNIDADES: readonly Unidade[] = ['barras', 'metros'];

export const CHAVES_SERIE = ['w61', 'w62'] as const;
export type ChaveSerie = (typeof CHAVES_SERIE)[number];
export const ROTULO_CURTO: Record<ChaveSerie, string> = { w61: 'W61', w62: 'W62' };

export const CORES = { w61: '#e8a33d', w62: '#16a34a' } as const;
export const ROTULOS = { w61: 'Recolhido W61', w62: 'Recolhido W62' } as const;

export interface SerieGrafico {
  chave: ChaveSerie;
  rotulo: string;
  cor: string;
  /** Valores por mês (jan a dez), já na unidade escolhida. */
  valores: number[];
}

/** Séries escolhidas no filtro (uma, duas ou as três). Vazio ou inválido = as três. */
export function parseSeries(texto: string | null | undefined): ChaveSerie[] {
  const pedidas = (texto ?? '').split(',').map((c) => c.trim());
  const escolhidas = CHAVES_SERIE.filter((c) => pedidas.includes(c));
  return escolhidas.length > 0 ? escolhidas : [...CHAVES_SERIE];
}

/** Rótulo do filtro para títulos e nomes de arquivo: "Total" quando as três estão marcadas. */
export function rotuloFiltro(chaves: ChaveSerie[]): string {
  return chaves.length === CHAVES_SERIE.length ? 'Total' : chaves.map((c) => ROTULO_CURTO[c]).join(' + ');
}

/**
 * Gráfico do período: só os meses em que alguma série escolhida tem dado (sem meses em branco),
 * com os valores já na unidade escolhida. Dados sempre em metros no banco.
 */
export function montarGrafico(meses: Quadro[], chaves: ChaveSerie[], unidade: Unidade): { indices: number[]; series: SerieGrafico[] } {
  const fator = unidade === 'barras' ? 1 / METROS_POR_BARRA : 1;
  const valorDe = (m: Quadro, c: ChaveSerie) => (c === 'w61' ? m.w61 : m.w62);
  const indices = meses.map((_, i) => i).filter((i) => chaves.some((c) => valorDe(meses[i], c) > 0));
  const series: SerieGrafico[] = chaves.map((chave) => ({
    chave,
    rotulo: ROTULOS[chave],
    cor: CORES[chave],
    valores: indices.map((i) => valorDe(meses[i], chave) * fator),
  }));
  return { indices, series };
}

const PASSOS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

/** Teto e passo do eixo, para ter poucas marcas e espaço acima da barra mais alta. */
export function niceEixo(topo: number): { max: number; passo: number } {
  const alvo = Math.max(topo * 1.08, 1);
  for (const passo of PASSOS) {
    if (alvo / passo <= 6) return { max: Math.ceil(alvo / passo) * passo, passo };
  }
  return { max: Math.ceil(alvo / 10000) * 10000, passo: 10000 };
}

/** Quais cartões aparecem para o filtro escolhido: só o que o filtro mostra. */
export function cartoesDoFiltro(chaves: ChaveSerie[]): { meta: boolean; w61: boolean; w62: boolean; pendente: boolean } {
  const tem = (c: ChaveSerie) => chaves.includes(c);
  return {
    meta: tem('w61') || tem('w62'),
    w61: tem('w61'),
    w62: tem('w62'),
    pendente: tem('w61') && tem('w62'), // a sobra precisa das duas séries de recolhimento
  };
}
