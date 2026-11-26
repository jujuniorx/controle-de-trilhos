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
  // A observação começa em 640: antes ela encostava no título "BARRAS DESC. / TOTAL".
  const col = { trilheiro: 10, bo: 96, diasBo: 180, partida: 278, diasPartida: 364, local: 462, barras: 540, obs: 640 };
  const yCabecalho = compacto ? topo - 36 : topo - 38;
  const rotulo = (texto: string, dx: number) => p.texto(texto, x + dx, yCabecalho, 6.5, 'negrito', CINZA);
  // Colunas de datas, dias e barras centralizadas na própria coluna (TRILHEIRO, LOCAL e OBSERVAÇÃO ficam à esquerda).
  const cen = { bo: 138, diasBo: 229, partida: 321, diasPartida: 413, barras: 584 };
  const centro = (texto: string, xc: number, y: number, tamanho: number, fonte: 'normal' | 'negrito', c: Cor) =>
    p.texto(texto, x + xc, y, tamanho, fonte, c, 'meio');
  const rotuloC = (texto: string, xc: number) => centro(texto, xc, yCabecalho, 6.5, 'negrito', CINZA);
  rotulo('TRILHEIRO', col.trilheiro);
  rotuloC('B.O.', cen.bo);
  rotuloC('DIAS DESDE B.O.', cen.diasBo);
  rotuloC('PARTIDA', cen.partida);
  rotuloC('DIAS DESDE PARTIDA', cen.diasPartida);
  centro('LOCAL', 501, yCabecalho, 6.5, 'negrito', CINZA);
  rotuloC('BARRAS DESC. / TOTAL', cen.barras);
  rotulo('OBSERVAÇÃO', col.obs);
  p.linha(x + 8, yCabecalho - 6, x + w - 8, yCabecalho - 6, LINHA, 0.6);

  const altLinha = compacto ? 30 : 40;
  const primeiraBase = yCabecalho - (compacto ? 22 : 26);
  if (t.equipes.length === 0) {
    p.texto('Nenhum trilheiro com lançamento neste período.', x + col.trilheiro, primeiraBase, 9, 'normal', CINZA);
    return;
  }
  // O cartão tem altura fixa: a observação usa até 4 linhas (3 no modo compacto), com espaçamento que cabe na linha.
  const espacoObs = compacto ? 8.5 : 7.8;
  const maxLinhasObs = compacto ? 3 : 4;
  // Sem dado: o mesmo traço cinza em todas as colunas.
  const vazio = (xc: number, y: number) => centro('—', xc, y, 9, 'normal', CINZA);
  t.equipes.forEach((e, i) => {
    const y = primeiraBase - i * altLinha;
    // Meio da linha = meio das maiúsculas dos números (10pt). Faixa zebrada, etiqueta e observação se centram nele.
    const meioLinha = y + 3.6;
    const todas = e.observacao ? quebrarLinhas(e.observacao, 7, w - col.obs - 16) : [];
    const linhasObs = todas.length > maxLinhasObs ? [...todas.slice(0, maxLinhasObs - 1), `${todas[maxLinhasObs - 1]!.replace(/\s+\S*$/, '')}…`] : todas;
    if (i % 2 === 1) p.retangulo(x + 4, meioLinha - (altLinha - 2) / 2, w - 8, altLinha - 2, ZEBRA);
    p.texto(e.trilheiro, x + col.trilheiro, y, 10, 'negrito', TINTA);
    if (e.bo) centro(brDaIso(e.bo), cen.bo, y, 9, 'normal', TINTA);
    else vazio(cen.bo, y);
    if (e.giroDias != null) centro(String(e.giroDias), cen.diasBo, y, 10, 'negrito', TINTA);
    else vazio(cen.diasBo, y);
    if (e.partida) centro(brDaIso(e.partida), cen.partida, y, 9, 'normal', TINTA);
    else vazio(cen.partida, y);
    if (e.diasDesdePartida != null) centro(String(e.diasDesdePartida), cen.diasPartida, y, 10, 'negrito', TINTA);
    else vazio(cen.diasPartida, y);
    if (e.local) {
      // Etiqueta do local: texto centralizado na horizontal e na vertical.
      const tamanho = 8;
      // Largura fixa mínima: todas as etiquetas ficam do mesmo tamanho.
      const largura = Math.max(larguraTexto(e.local, tamanho, 'negrito') + 12, 34);
      const alturaEtiqueta = 13;
      const xEtiqueta = x + 501 - largura / 2;
      p.arredondado(xEtiqueta, meioLinha - alturaEtiqueta / 2, largura, alturaEtiqueta, 6, NAVY);
      p.texto(e.local, x + 501, meioLinha - tamanho * 0.36, tamanho, 'negrito', BRANCO, 'meio');
    } else {
      vazio(501, y);
    }
    centro(`${e.descarregadas} / ${e.total}`, cen.barras, y, 10, 'negrito', COR_TRILHEIROS);
    // Bloco da observação centrado no meio da linha.
    const primeira = meioLinha - 7 * 0.36 + ((linhasObs.length - 1) * espacoObs) / 2;
    linhasObs.forEach((linha, k) => p.texto(linha, x + col.obs, primeira - k * espacoObs, 7, 'normal', CINZA));
  });
}

function brDaIso(iso: string | null): string {
  return iso ? iso.split('-').reverse().join('/') : '—';
}
