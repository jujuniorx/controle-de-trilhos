import { PaginaPdf, A4_PAISAGEM, montarPdfVarias, larguraTexto } from '@/lib/pdf/simples';
import type { DadosRelatorio, GraficoRelatorio, SetorRelatorio } from '@/lib/services/onePageUsina';
import { faixaSemanaSegSex } from '@/lib/usina/periodo';

type Cor = [number, number, number];

const hex = (h: string): Cor => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const BRANCO: Cor = [1, 1, 1];
const FUNDO_CARTAO: Cor = [0.97, 0.98, 0.99];
const LINHA: Cor = [0.86, 0.88, 0.91];
const TINTA: Cor = [0.1, 0.12, 0.16];
const CINZA: Cor = [0.42, 0.45, 0.5];

const L = A4_PAISAGEM.largura; // 842
const H = A4_PAISAGEM.altura; // 595
const M = 36;


/** Texto alinhado à direita, com a borda direita em `xDireita`. */
function textoDireita(p: PaginaPdf, texto: string, xDireita: number, y: number, tamanho: number, fonte: 'normal' | 'negrito', c: Cor) {
  p.texto(texto, xDireita - larguraTexto(texto, tamanho, fonte), y, tamanho, fonte, c);
}

/** Gráfico de barras por dia: uma barra por série e por dia, na área (x, yBase) até (x+w, yBase+altura). */
function desenharGrafico(p: PaginaPdf, g: GraficoRelatorio, x: number, yBase: number, w: number, altura: number) {
  const n = Math.max(1, ...g.series.map((s) => s.valores.length));
  const topo = Math.max(1, ...g.series.flatMap((s) => s.valores));
  const gw = w / n;
  const bw = Math.max(0.6, Math.min(4, (gw * 0.75) / g.series.length));
  g.series.forEach((s, si) => {
    s.valores.forEach((v, i) => {
      const h = (Math.max(0, v) / topo) * altura;
      if (h <= 0) return;
      const bx = x + i * gw + gw / 2 - (g.series.length * bw) / 2 + si * bw;
      p.retangulo(bx, yBase, bw * 0.9, h, hex(s.cor));
    });
  });
  p.linha(x, yBase, x + w, yBase, LINHA, 0.6);
}

function desenharSetor(p: PaginaPdf, s: SetorRelatorio, x: number, topo: number, w: number, h: number, largo = false) {
  const base = topo - h;
  p.retangulo(x, base, w, h, FUNDO_CARTAO);
  p.retangulo(x, topo - 20, w, 20, hex(s.cor));
  p.texto(s.titulo.toUpperCase(), x + 8, topo - 14, 8, 'negrito', BRANCO);

  // Tabela Dia | Mês. No cartão largo ela fica à esquerda e o gráfico à direita.
  const xDia = largo ? x + 330 : x + w - 92;
  const xMes = largo ? x + 420 : x + w - 10;
  let y = topo - 32;
  textoDireita(p, 'DIA', xDia, y, 6.5, 'negrito', CINZA);
  textoDireita(p, 'SEMANA', xMes, y, 6.5, 'negrito', CINZA);
  y -= 6;
  p.linha(x + 8, y, xMes + 2, y, LINHA, 0.6);
  for (const linha of s.linhas) {
    y -= 12;
    p.texto(linha.rotulo, x + 8, y, 8, 'normal', TINTA);
    textoDireita(p, linha.dia, xDia, y, 8, 'negrito', TINTA);
    textoDireita(p, linha.mes, xMes, y, 8, 'negrito', hex(s.cor));
  }

  if (!s.grafico) return;
  if (largo) {
    // Gráfico à direita, na mesma altura da tabela
    const xg = x + 470;
    const wg = w - 482;
    let lx = xg;
    const yLegenda = topo - 46;
    for (const serie of s.grafico.series) {
      p.retangulo(lx, yLegenda, 6, 6, hex(serie.cor));
      p.texto(serie.nome, lx + 9, yLegenda, 6.5, 'normal', CINZA);
      lx += 9 + larguraTexto(serie.nome, 6.5) + 14;
    }
    p.texto(s.grafico.titulo, xg, topo - 32, 6.5, 'negrito', CINZA);
    desenharGrafico(p, s.grafico, xg, base + 14, wg, Math.max(40, h - 60));
    textoDireita(p, 'Segunda a sexta', xg + wg, base + 3, 6, 'negrito', CINZA);
    return;
  }
  // Gráfico da semana, na parte de baixo do cartão (abaixo da tabela)
  const yLegenda = base + 12;
  let lx = x + 8;
  for (const serie of s.grafico.series) {
    p.retangulo(lx, yLegenda, 6, 6, hex(serie.cor));
    p.texto(serie.nome, lx + 9, yLegenda, 6.5, 'normal', CINZA);
    lx += 9 + larguraTexto(serie.nome, 6.5) + 14;
  }
  p.texto(s.grafico.titulo, x + 8, base + 104, 6.5, 'negrito', CINZA);
  desenharGrafico(p, s.grafico, x + 8, base + 24, w - 16, 70);
  textoDireita(p, 'Segunda a sexta', x + w - 8, base + 12, 6, 'negrito', CINZA);
}

export function gerarOnePageUsinaPdf(d: DadosRelatorio): Buffer {
  const p = new PaginaPdf();
  p.retangulo(0, 0, L, H, BRANCO);

  // Cabeçalho
  p.texto('CONTROLE DE TRILHOS', M, H - 26, 7.5, 'negrito', CINZA);
  p.texto('Relatório gerencial', M, H - 50, 20, 'negrito', TINTA);
  textoDireita(p, 'SEMANA (SEGUNDA A SEXTA)', L - M, H - 26, 7, 'negrito', CINZA);
  textoDireita(p, faixaSemanaSegSex(d.data), L - M, H - 48, 15, 'negrito', TINTA);
  p.linha(M, H - 60, L - M, H - 60, [0.1, 0.12, 0.16], 1.2);

  // Resumo: dia e semana separados em cada setor
  const gap = 10;
  const wRes = (L - 2 * M - (d.resumo.length - 1) * gap) / d.resumo.length;
  const topoRes = H - 70;
  const altRes = 56;
  d.resumo.forEach((r, i) => {
    const x = M + i * (wRes + gap);
    p.retangulo(x, topoRes - altRes, wRes, altRes, FUNDO_CARTAO);
    p.retangulo(x, topoRes - 3, wRes, 3, hex(r.cor));
    p.texto(r.rotulo.toUpperCase(), x + 8, topoRes - 17, 7, 'negrito', TINTA);
    const meio = x + wRes / 2 + 4;
    p.texto('Do dia', x + 8, topoRes - 30, 6.5, 'normal', CINZA);
    p.texto(r.dia, x + 8, topoRes - 46, 11, 'negrito', TINTA);
    p.texto('Da semana', meio, topoRes - 30, 6.5, 'normal', CINZA);
    p.texto(r.mes, meio, topoRes - 46, 11, 'negrito', hex(r.cor));
  });

  // Página 1: setores em grade de 3 colunas.
  const colunas = 3;
  const gapC = 12;
  const wSet = (L - 2 * M - (colunas - 1) * gapC) / colunas;
  const altSet = 230;
  const topoGrade = topoRes - altRes - 16;
  d.setores.slice(0, colunas).forEach((s, i) => {
    const x = M + i * (wSet + gapC);
    desenharSetor(p, s, x, topoGrade, wSet, altSet);
  });

  const emitido = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  p.texto(`Emitido em ${emitido}`, M, 18, 6.5, 'normal', CINZA);

  // Página 2 (quando houver): Caminhão e Trilheiros, um sobre o outro, na largura toda, com espaço para as linhas.
  const restantes = d.setores.slice(colunas);
  if (restantes.length === 0) return montarPdfVarias([p], `Relatório gerencial usina ${d.data}`, A4_PAISAGEM);
  const p2 = new PaginaPdf();
  p2.retangulo(0, 0, L, H, BRANCO);
  p2.texto('CONTROLE DE TRILHOS', M, H - 26, 7.5, 'negrito', CINZA);
  p2.texto('Relatório gerencial (continuação)', M, H - 50, 16, 'negrito', TINTA);
  textoDireita(p2, 'SEMANA (SEGUNDA A SEXTA)', L - M, H - 26, 7, 'negrito', CINZA);
  textoDireita(p2, faixaSemanaSegSex(d.data), L - M, H - 48, 15, 'negrito', TINTA);
  p2.linha(M, H - 60, L - M, H - 60, [0.1, 0.12, 0.16], 1.2);
  let topo = H - 74;
  for (const s of restantes) {
    const alt = s.titulo === 'Trilheiros' ? 250 : 170;
    desenharSetor(p2, s, M, topo, L - 2 * M, alt, true);
    topo -= alt + 12;
  }
  p2.texto(`Emitido em ${emitido}`, M, 18, 6.5, 'normal', CINZA);

  return montarPdfVarias([p, p2], `Relatório gerencial usina ${d.data}`, A4_PAISAGEM);
}
