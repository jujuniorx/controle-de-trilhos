import { PaginaPdf, A4_PAISAGEM, montarPdfVarias, larguraTexto } from '@/lib/pdf/simples';
import type { DadosRelatorio, GraficoRelatorio, SetorRelatorio, TrilheirosRelatorio } from '@/lib/services/onePageUsina';
import { faixaSemanaSegSex } from '@/lib/usina/periodo';
import { desenharTrilheiros } from '@/lib/pdf/tabelaTrilheiros';

type Cor = [number, number, number];

export const hex = (h: string): Cor => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
export const BRANCO: Cor = [1, 1, 1];
export const LINHA: Cor = [0.86, 0.88, 0.91];
export const TINTA: Cor = [0.1, 0.12, 0.16];
export const CINZA: Cor = [0.42, 0.45, 0.5];
export const NAVY: Cor = hex('#0b1b31');
export const AZUL: Cor = hex('#2f6fb8');
export const ZEBRA: Cor = [0.955, 0.965, 0.975];
export const SOMBRA: Cor = [0.9, 0.92, 0.945];

export const L = A4_PAISAGEM.largura; // 842
export const H = A4_PAISAGEM.altura; // 595
export const M = 36;


/** Texto alinhado à direita, com a borda direita em `xDireita`. */
export function textoDireita(p: PaginaPdf, texto: string, xDireita: number, y: number, tamanho: number, fonte: 'normal' | 'negrito', c: Cor) {
  p.texto(texto, xDireita - larguraTexto(texto, tamanho, fonte), y, tamanho, fonte, c);
}

/** Gráfico de barras por dia: uma barra por série e por dia, na área (x, yBase) até (x+w, yBase+altura). */
export function desenharGrafico(p: PaginaPdf, g: GraficoRelatorio, x: number, yBase: number, w: number, altura: number, rotulos: string[] = []) {
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
  // Nome do dia (Seg 19, Ter 20...) embaixo de cada grupo de barras.
  const yRotulo = yBase - 9;
  rotulos.forEach((r, i) => {
    const cx = x + i * gw + gw / 2;
    p.texto(r, cx - larguraTexto(r, 6) / 2, yRotulo, 6, 'normal', CINZA);
  });
}

export function desenharSetor(p: PaginaPdf, s: SetorRelatorio, x: number, topo: number, w: number, h: number, largo = false, rotulos: string[] = []) {
  const base = topo - h;
  p.arredondado(x + 1.2, base - 1.4, w, h, 9, SOMBRA);
  p.arredondado(x, base, w, h, 9, BRANCO, LINHA);
  p.arredondado(x, topo - 22, w, 22, 9, hex(s.cor));
  p.retangulo(x, topo - 22, w, 8, hex(s.cor));
  p.texto(s.titulo.toUpperCase(), x + 8, topo - 14, 8, 'negrito', BRANCO);

  // Tabela Dia | Mês. No cartão largo ela fica à esquerda e o gráfico à direita.
  const xDia = largo ? x + 330 : x + w - 92;
  const xMes = largo ? x + 420 : x + w - 10;
  let y = topo - 32;
  textoDireita(p, 'DIA', xDia, y, 6.5, 'negrito', CINZA);
  textoDireita(p, 'SEMANA', xMes, y, 6.5, 'negrito', CINZA);
  y -= 6;
  p.linha(x + 8, y, xMes + 2, y, LINHA, 0.6);
  s.linhas.forEach((linha, i) => {
    y -= 12;
    if (i % 2 === 1) p.retangulo(x + 4, y - 3.5, w - 8, 12, ZEBRA);
    p.texto(linha.rotulo, x + 8, y, 8, 'normal', TINTA);
    textoDireita(p, linha.dia, xDia, y, 8, 'negrito', TINTA);
    textoDireita(p, linha.mes, xMes, y, 8, 'negrito', hex(s.cor));
  });

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
    desenharGrafico(p, s.grafico, xg, base + 22, wg, Math.max(40, h - 66), rotulos);
    textoDireita(p, 'Segunda a quinta', xg + wg, base + 3, 6, 'negrito', CINZA);
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
  // Sem título próprio: a legenda já diz as séries, e o gráfico fica abaixo da tabela.
  desenharGrafico(p, s.grafico, x + 8, base + 30, w - 16, 40, rotulos);
  textoDireita(p, 'Segunda a quinta', x + w - 8, base + 12, 6, 'negrito', CINZA);
}

export function gerarOnePageUsinaPdf(d: DadosRelatorio, tril: TrilheirosRelatorio): Buffer {
  const p = new PaginaPdf();
  p.retangulo(0, 0, L, H, BRANCO);
  // Faixa de marca no topo
  p.retangulo(0, H - 5, L, 5, NAVY);
  p.retangulo(0, H - 5, L * 0.35, 5, AZUL);

  // Cabeçalho
  p.texto('CONTROLE DE TRILHOS', M, H - 26, 7.5, 'negrito', AZUL);
  p.texto('Relatório gerencial', M, H - 52, 21, 'negrito', TINTA);
  const semana = faixaSemanaSegSex(d.data);
  const wPilula = larguraTexto(semana, 10, 'negrito') + 26;
  p.arredondado(L - M - wPilula, H - 54, wPilula, 22, 11, hex('#e9f1fb'));
  textoDireita(p, semana, L - M - 13, H - 47, 10, 'negrito', NAVY);
  textoDireita(p, 'SEGUNDA A QUINTA', L - M, H - 26, 7, 'negrito', CINZA);
  p.linha(M, H - 62, L - M, H - 62, LINHA, 0.8);

  // Resumo: dia e semana separados em cada setor
  const gap = 10;
  const wRes = (L - 2 * M - (d.resumo.length - 1) * gap) / d.resumo.length;
  const topoRes = H - 70;
  const altRes = 56;
  d.resumo.forEach((r, i) => {
    const x = M + i * (wRes + gap);
    p.arredondado(x + 1, topoRes - altRes - 1.2, wRes, altRes, 9, SOMBRA);
    p.arredondado(x, topoRes - altRes, wRes, altRes, 9, BRANCO, LINHA);
    p.arredondado(x + 8, topoRes - 15, 6, 6, 3, hex(r.cor));
    p.texto(r.rotulo.toUpperCase(), x + 18, topoRes - 14, 7, 'negrito', TINTA);
    const meio = x + wRes / 2 + 4;
    p.texto('Do dia', x + 8, topoRes - 30, 6.5, 'normal', CINZA);
    p.texto(r.dia, x + 8, topoRes - 46, 10, 'negrito', TINTA);
    p.texto('Da semana', meio, topoRes - 30, 6.5, 'normal', CINZA);
    p.texto(r.mes, meio, topoRes - 46, 10, 'negrito', hex(r.cor));
  });

  // Linha 1: Estaleiro, Geração e Recolhimento serra, lado a lado.
  const colunas = 3;
  const gapC = 12;
  const wSet = (L - 2 * M - (colunas - 1) * gapC) / colunas;
  const altSet = 180;
  const topoGrade = topoRes - altRes - 16;
  const porTitulo = (t: string) => d.setores.find((s) => s.titulo === t);
  const linha1 = d.setores.filter((s) => s.titulo !== 'Caminhão de solda' && s.titulo !== 'Trilheiros');
  linha1.slice(0, colunas).forEach((s, i) => {
    desenharSetor(p, s, M + i * (wSet + gapC), topoGrade, wSet, altSet, false, d.rotulosDias);
  });

  // Linhas 2 e 3: Caminhão de solda e Trilheiros, um embaixo do outro, cada um na largura toda.
  const larguraTotal = L - 2 * M;
  const altCaminhao = 74;
  const gapLinha = 6;
  const topoLinha2 = topoGrade - altSet - 12;
  const caminhao = porTitulo('Caminhão de solda');
  if (caminhao) desenharSetor(p, caminhao, M, topoLinha2, larguraTotal, altCaminhao, true, d.rotulosDias);
  // Trilheiros: a mesma tabela do PDF por setor, em versão compacta.
  const altTrilheiros = Math.max(90, 46 + Math.max(1, tril.equipes.length) * 30 + 8);
  desenharTrilheiros(p, tril, M, topoLinha2 - altCaminhao - gapLinha, larguraTotal, altTrilheiros, true);

  const emitido = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  p.linha(M, 30, L - M, 30, LINHA, 0.6);
  p.texto(`Emitido em ${emitido}`, M, 18, 6.5, 'normal', CINZA);
  textoDireita(p, 'Controle de Trilhos · Usina', L - M, 18, 6.5, 'negrito', CINZA);

  return montarPdfVarias([p], `Relatório gerencial usina ${d.data}`, A4_PAISAGEM);
}
