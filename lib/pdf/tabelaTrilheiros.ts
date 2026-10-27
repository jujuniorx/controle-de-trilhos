import { PaginaPdf, larguraTexto, quebrarLinhas } from '@/lib/pdf/simples';
import type { TrilheirosRelatorio } from '@/lib/services/onePageUsina';

type Cor = [number, number, number];
const hex = (h: string): Cor => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const BRANCO: Cor = [1, 1, 1];
const LINHA: Cor = [0.86, 0.88, 0.91];
const TINTA: Cor = [0.1, 0.12, 0.16];
const CINZA: Cor = [0.42, 0.45, 0.5];
const NAVY: Cor = hex('#0b1b31');
const ZEBRA: Cor = [0.955, 0.965, 0.975];
const SOMBRA: Cor = [0.9, 0.92, 0.945];

const COR_TRILHEIROS = hex('#0891b2');

/** Tabela dos trilheiros: uma linha por trilheiro, com B.O., partida, local, barras e observação. */
export function desenharTrilheiros(p: PaginaPdf, t: TrilheirosRelatorio, x: number, topo: number, w: number, h: number, compacto = false) {
  const base = topo - h;
  p.arredondado(x + 1.2, base - 1.4, w, h, 9, SOMBRA);
  p.arredondado(x, base, w, h, 9, BRANCO, LINHA);
  p.arredondado(x, topo - 22, w, 22, 9, COR_TRILHEIROS);
  p.retangulo(x, topo - 22, w, 8, COR_TRILHEIROS);
  p.texto('Trilheiros', x + 10, topo - 14, 8, 'negrito', BRANCO);

  // Colunas (deslocamento a partir da borda esquerda do cartão)
  const col = { trilheiro: 10, bo: 96, diasBo: 180, partida: 278, diasPartida: 364, local: 462, barras: 540, obs: 628 };
  const yCabecalho = compacto ? topo - 36 : topo - 38;
  const rotulo = (texto: string, dx: number) => p.texto(texto, x + dx, yCabecalho, 6.5, 'negrito', CINZA);
  rotulo('TRILHEIRO', col.trilheiro);
  rotulo('B.O.', col.bo);
  rotulo('DIAS DESDE B.O.', col.diasBo);
  rotulo('PARTIDA', col.partida);
  rotulo('DIAS DESDE PARTIDA', col.diasPartida);
  rotulo('LOCAL', col.local);
  rotulo('BARRAS DESC. / TOTAL', col.barras);
  rotulo('OBSERVAÇÃO', col.obs);
  p.linha(x + 8, yCabecalho - 6, x + w - 8, yCabecalho - 6, LINHA, 0.6);

  const altLinha = compacto ? 30 : 40;
  const primeiraBase = yCabecalho - (compacto ? 22 : 26);
  if (t.equipes.length === 0) {
    p.texto('Nenhum trilheiro com lançamento neste período.', x + col.trilheiro, primeiraBase, 9, 'normal', CINZA);
    return;
  }
  t.equipes.forEach((e, i) => {
    const y = primeiraBase - i * altLinha;
    if (i % 2 === 1) p.retangulo(x + 4, y - (compacto ? 10 : 14), w - 8, altLinha - 2, ZEBRA);
    p.texto(e.trilheiro, x + col.trilheiro, y, 10, 'negrito', TINTA);
    p.texto(brDaIso(e.bo), x + col.bo, y, 9, 'normal', TINTA);
    p.texto(e.giroDias == null ? '—' : String(e.giroDias), x + col.diasBo, y, 10, 'negrito', TINTA);
    p.texto(brDaIso(e.partida), x + col.partida, y, 9, 'normal', TINTA);
    p.texto(e.diasDesdePartida == null ? '—' : String(e.diasDesdePartida), x + col.diasPartida, y, 10, 'negrito', TINTA);
    if (e.local) {
      // Etiqueta do local: texto centralizado na horizontal e na vertical.
      const tamanho = 8;
      // Largura fixa mínima: todas as etiquetas ficam do mesmo tamanho, e a diferença de fonte do visualizador não desloca o texto.
      const largura = Math.max(larguraTexto(e.local, tamanho, 'negrito') + 12, 34);
      const alturaEtiqueta = 13;
      const yEtiqueta = y - 3;
      p.arredondado(x + col.local, yEtiqueta, largura, alturaEtiqueta, 6, NAVY);
      const xTexto = x + col.local + (largura - larguraTexto(e.local, tamanho, 'negrito')) / 2;
      const yTexto = yEtiqueta + (alturaEtiqueta - tamanho * 0.7) / 2;
      p.texto(e.local, xTexto, yTexto, tamanho, 'negrito', BRANCO);
    } else {
      p.texto('—', x + col.local, y, 9, 'normal', CINZA);
    }
    p.texto(`${e.descarregadas} / ${e.total}`, x + col.barras, y, 10, 'negrito', COR_TRILHEIROS);
    const linhas = e.observacao ? quebrarLinhas(e.observacao, 7.5, w - col.obs - 16) : [];
    const maxLinhas = 3;
    const espaco = 8.5;
    linhas.slice(0, maxLinhas).forEach((linha, k) => p.texto(linha, x + col.obs, y + 9 - k * espaco, 7.5, 'normal', CINZA));
  });
}

function brDaIso(iso: string | null): string {
  return iso ? iso.split('-').reverse().join('/') : '—';
}
