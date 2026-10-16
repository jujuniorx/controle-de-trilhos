import { METROS_POR_BARRA } from '@/lib/domain/informativo';
import type { Quadro } from '@/lib/services/informativo';

/** Série do gráfico: tudo junto, só o que chegou na usina, ou só W61 / W62. */
export type Serie = 'tudo' | 'usina' | 'w61' | 'w62';
/** Unidade do eixo: barras (W61/W62 nativos; usina convertida) ou metros (W61/W62 × 10,5; usina real). */
export type Unidade = 'barras' | 'metros';

export const SERIES: readonly Serie[] = ['tudo', 'usina', 'w61', 'w62'];
export const UNIDADES: readonly Unidade[] = ['barras', 'metros'];

export const ROTULO_SERIE: Record<Serie, string> = { tudo: 'Tudo junto', usina: 'Só usina', w61: 'Só W61', w62: 'Só W62' };

export const CORES = { usina: '#4a6cd4', w61: '#e8a33d', w62: '#16a34a' } as const;
export const ROTULOS = { usina: 'Chegou na usina', w61: 'Recolhido W61', w62: 'Recolhido W62' } as const;

export type ChaveSerie = keyof typeof CORES;

export interface SerieGrafico {
  chave: ChaveSerie;
  rotulo: string;
  cor: string;
  /** Valores por mês (jan a dez), já na unidade escolhida. */
  valores: number[];
}

/** Valores por mês de cada série escolhida, convertidos para a unidade. Dados sempre em metros no banco. */
export function seriesDoGrafico(meses: Quadro[], serie: Serie, unidade: Unidade): SerieGrafico[] {
  const chaves: ChaveSerie[] = serie === 'tudo' ? ['usina', 'w61', 'w62'] : [serie];
  const fator = unidade === 'barras' ? 1 / METROS_POR_BARRA : 1;
  return chaves.map((chave) => ({
    chave,
    rotulo: ROTULOS[chave],
    cor: CORES[chave],
    valores: meses.map((m) => (chave === 'usina' ? m.recebido : chave === 'w61' ? m.w61 : m.w62) * fator),
  }));
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
