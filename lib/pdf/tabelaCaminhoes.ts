import { PaginaPdf, larguraTexto } from '@/lib/pdf/simples';
import type { CaminhaoTabelaRelatorio } from '@/lib/services/onePageUsina';

type Cor = [number, number, number];
const hex = (h: string): Cor => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const BRANCO: Cor = [1, 1, 1];
const LINHA: Cor = [0.86, 0.88, 0.91];
const TINTA: Cor = [0.1, 0.12, 0.16];
const CINZA: Cor = [0.42, 0.45, 0.5];
const ZEBRA: Cor = [0.955, 0.965, 0.975];
const SOMBRA: Cor = [0.9, 0.92, 0.945];

/** Tabela do caminhão de solda, no mesmo formato da tabela de trilheiros: uma linha por caminhão. */
export function desenharCaminhoes(p: PaginaPdf, caminhoes: CaminhaoTabelaRelatorio[], cor: string, x: number, topo: number, w: number, h: number) {
  const base = topo - h;
  const corSetor = hex(cor);
  p.arredondado(x + 1.2, base - 1.4, w, h, 9, SOMBRA);
  p.arredondado(x, base, w, h, 9, BRANCO, LINHA);
  p.arredondado(x, topo - 22, w, 22, 9, corSetor);
  p.retangulo(x, topo - 22, w, 8, corSetor);
  p.texto('CAMINHÃO DE SOLDA', x + 10, topo - 14, 8, 'negrito', BRANCO);

  // Colunas: números alinhados à direita (borda direita de cada coluna).
  const col = {
    nome: 10,
    soldaDia: 200,
    soldaSem: 268,
    soldaMes: 336,
    corteDia: 410,
    corteSem: 478,
    corteMes: 546,
    local: 600,
    obs: 690,
  };
  const yGrupo = topo - 34;
  const yCabecalho = topo - 44;
  // Títulos de grupo, centralizados sobre as três colunas de cada um.
  const centro = (texto: string, a: number, b: number) => {
    const meio = (x + a + x + b) / 2;
    p.texto(texto, meio - larguraTexto(texto, 7, 'negrito') / 2, yGrupo, 7, 'negrito', TINTA);
  };
  centro('SOLDA (UND)', col.soldaDia - 30, col.soldaMes + 2);
  centro('CORTE (UND)', col.corteDia - 30, col.corteMes + 2);
  const dir = (texto: string, xDireita: number, y: number, tamanho: number, fonte: 'normal' | 'negrito', c: Cor) =>
    p.texto(texto, x + xDireita - larguraTexto(texto, tamanho, fonte), y, tamanho, fonte, c);
  const rotulo = (texto: string, dx: number) => p.texto(texto, x + dx, yCabecalho, 6.5, 'negrito', CINZA);
  rotulo('CAMINHÃO', col.nome);
  dir('DIA', col.soldaDia, yCabecalho, 6.5, 'negrito', CINZA);
  dir('SEMANA', col.soldaSem, yCabecalho, 6.5, 'negrito', CINZA);
  dir('NO MÊS', col.soldaMes, yCabecalho, 6.5, 'negrito', CINZA);
  dir('DIA', col.corteDia, yCabecalho, 6.5, 'negrito', CINZA);
  dir('SEMANA', col.corteSem, yCabecalho, 6.5, 'negrito', CINZA);
  dir('NO MÊS', col.corteMes, yCabecalho, 6.5, 'negrito', CINZA);
  rotulo('LOCAL', col.local);
  rotulo('OBSERVAÇÃO', col.obs);
  p.linha(x + 8, yCabecalho - 6, x + w - 8, yCabecalho - 6, LINHA, 0.6);

  const altLinha = 30;
  const primeiraBase = yCabecalho - 22;
  caminhoes.forEach((c, i) => {
    const y = primeiraBase - i * altLinha;
    if (i % 2 === 1) p.retangulo(x + 4, y - 10, w - 8, altLinha - 2, ZEBRA);
    p.texto(c.nome, x + col.nome, y, 10, 'negrito', TINTA);
    dir(String(c.solda.dia), col.soldaDia, y, 10, 'negrito', TINTA);
    dir(String(c.solda.semana), col.soldaSem, y, 10, 'negrito', TINTA);
    dir(String(c.solda.mes), col.soldaMes, y, 10, 'negrito', corSetor);
    dir(String(c.corte.dia), col.corteDia, y, 10, 'negrito', TINTA);
    dir(String(c.corte.semana), col.corteSem, y, 10, 'negrito', TINTA);
    dir(String(c.corte.mes), col.corteMes, y, 10, 'negrito', corSetor);
    // Local: ainda não é lançado; aparece como traço até o campo existir.
    p.texto('—', x + col.local, y, 9, 'normal', CINZA);
    p.texto('—', x + col.obs, y, 9, 'normal', CINZA);
  });
}
