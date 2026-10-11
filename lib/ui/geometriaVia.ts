/**
 * Geometria da linha férrea em perspectiva (usada por components/ui/FundoTrilhos.tsx).
 *
 * Coordenadas em % da área da via: x de 0 a 100, y de 0 (horizonte) a 100 (base da tela).
 * Perspectiva: o que está a uma distância z aparece em y = 100 / z (z = 1 na base).
 * O centro da via faz uma curva suave: em y = 0 fica deslocado BEND para a direita e vai
 * endireitando até a base (desvio proporcional a (1 - t)²).
 *
 * Os valores abaixo também estão fixos nos @keyframes de app/globals.css (bloco "trilhos"),
 * gerados por scripts/gerar-keyframes-via.mjs — se mudar aqui, rode o script de novo.
 */
export const BEND = 0;
export const BITOLA_METADE = 13.5; // metade da distância entre os trilhos, na base
export const DORMENTE_METADE = 22; // metade do comprimento do dormente, na base
export const LASTRO_METADE = 31; // metade da largura do lastro de pedra, na base
export const QTD_DORMENTES = 22;
export const DURACAO_DORMENTES_S = 5;

const f = (n: number) => Math.round(n * 100) / 100;
export const centro = (t: number) => 50 + BEND * (1 - t) * (1 - t);

/** Faixa que acompanha a curva: `lado` (-1 esquerda, +1 direita) × `meia` (meia-largura) em função de t. */
function faixa(offsetBase: number, largTopo: number, largBase: number, deslocaX = 0, amostras = 28): string {
  const esq: string[] = [];
  const dir: string[] = [];
  for (let i = 0; i <= amostras; i++) {
    const t = i / amostras;
    const c = centro(t) + offsetBase * t + deslocaX * t;
    const w = (largTopo + (largBase - largTopo) * t) / 2;
    esq.push(`${f(c - w)},${f(t * 100)}`);
    dir.unshift(`${f(c + w)},${f(t * 100)}`);
  }
  return [...esq, ...dir].join(' ');
}

/** Linha central (para o brilho que corre pelo trilho). */
function linha(offsetBase: number, amostras = 28): string {
  const pts: string[] = [];
  for (let i = 0; i <= amostras; i++) {
    const t = i / amostras;
    pts.push(`${f(centro(t) + offsetBase * t)},${f(t * 100)}`);
  }
  return pts.join(' ');
}

export function geometriaVia() {
  const L = -BITOLA_METADE;
  const R = BITOLA_METADE;
  return {
    lastro: faixa(0, 1.2, LASTRO_METADE * 2),
    lastroBorda: faixa(0, 0.4, LASTRO_METADE * 2 + 5),
    sombra: [faixa(L + 0.9, 0.2, 3.6), faixa(R + 0.9, 0.2, 3.6)],
    corpo: [faixa(L, 0.12, 2.3), faixa(R, 0.12, 2.3)],
    topo: [faixa(L, 0.06, 1.1, -0.2), faixa(R, 0.06, 1.1, -0.2)],
    brilho: [linha(L - 0.2), linha(R - 0.2)],
  };
}
