import { PaginaPdf, A4_PAISAGEM, montarPdfVarias, larguraTexto } from '@/lib/pdf/simples';
import type { DadosRelatorio, GraficoRelatorio, SerraRelatorio, SetorRelatorio, TrilheirosRelatorio } from '@/lib/services/onePageUsina';
import { faixaSemanaSegSex, mesAte } from '@/lib/usina/periodo';
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

/** Valor alinhado à direita com partes separadas por ' / ', cada parte na sua cor (ex.: W61 e W62). */
function valorDireitaComCores(p: PaginaPdf, valor: string, cores: string[] | undefined, xDireita: number, y: number, tamanho: number, fonte: 'normal' | 'negrito', corPadrao: Cor) {
  const partes = valor.split(' / ');
  if (!cores || partes.length !== cores.length) {
    textoDireita(p, valor, xDireita, y, tamanho, fonte, corPadrao);
    return;
  }
  let x = xDireita;
  for (let i = partes.length - 1; i >= 0; i--) {
    textoDireita(p, partes[i]!, x, y, tamanho, fonte, hex(cores[i]!));
    x -= larguraTexto(partes[i]!, tamanho, fonte);
    if (i > 0) {
      textoDireita(p, ' / ', x, y, tamanho, fonte, CINZA);
      x -= larguraTexto(' / ', tamanho, fonte);
    }
  }
}

/** Tabela da serra: W61 e W62 nas linhas; Dia, Semana e Mês com barras e metros, cada composição na sua cor. */
function desenharTabelaSerra(p: PaginaPdf, serra: SerraRelatorio, x: number, topo: number, w: number) {
  const colunaRotulo = 42;
  const colW = (w - colunaRotulo - 12) / 6;
  // Borda direita de cada coluna (barras e metros de Dia, Semana e Mês).
  const fim = (c: number) => x + colunaRotulo + (c + 1) * colW - 4;
  const grupos: { rotulo: string; chave: 'dia' | 'semana' | 'mes' }[] = [
    { rotulo: 'DIA', chave: 'dia' },
    { rotulo: 'SEMANA', chave: 'semana' },
    { rotulo: 'NO MÊS', chave: 'mes' },
  ];
  let y = topo - 32;
  grupos.forEach((g, gi) => textoDireita(p, g.rotulo, fim(gi * 2 + 1), y, 6.5, 'negrito', CINZA));
  y -= 9;
  grupos.forEach((_, gi) => {
    textoDireita(p, 'Barras', fim(gi * 2), y, 6, 'negrito', CINZA);
    textoDireita(p, 'Metros', fim(gi * 2 + 1), y, 6, 'negrito', CINZA);
  });
  y -= 5;
  p.linha(x + 8, y, x + w - 8, y, LINHA, 0.6);
  const medidas = (m: { barras: number; metros: number }, gi: number, cor: Cor) => {
    textoDireita(p, String(m.barras), fim(gi * 2), y, 8.5, 'negrito', cor);
    textoDireita(p, fmtMetrosPdf(m.metros), fim(gi * 2 + 1), y, 8.5, 'negrito', cor);
  };
  serra.linhas.forEach((l, i) => {
    y -= 11;
    if (i % 2 === 1) p.retangulo(x + 4, y - 3, w - 8, 11, ZEBRA);
    p.texto(l.ativo, x + 8, y, 8, 'negrito', hex(l.cor));
    grupos.forEach((g, gi) => medidas(l[g.chave], gi, hex(l.cor)));
  });
  y -= 11;
  p.texto('Total', x + 8, y, 8, 'negrito', TINTA);
  grupos.forEach((g, gi) => medidas(serra.total[g.chave], gi, TINTA));
}

function fmtMetrosPdf(v: number): string {
  // Sem casas decimais: a tabela do cartão é estreita e os metros inteiros bastam para leitura.
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
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

export function desenharSetor(p: PaginaPdf, s: SetorRelatorio, x: number, topo: number, w: number, h: number, largo = false, rotulos: string[] = [], mensal = false) {
  const base = topo - h;
  p.arredondado(x + 1.2, base - 1.4, w, h, 9, SOMBRA);
  p.arredondado(x, base, w, h, 9, BRANCO, LINHA);
  p.arredondado(x, topo - 22, w, 22, 9, hex(s.cor));
  p.retangulo(x, topo - 22, w, 8, hex(s.cor));
  p.texto(s.titulo.toUpperCase(), x + 8, topo - 14, 8, 'negrito', BRANCO);
  if (s.serra) {
    desenharTabelaSerra(p, s.serra, x, topo, w);
    if (s.grafico) {
      desenharGrafico(p, s.grafico, x + 8, base + 30, w - 16, 22, rotulos);
    }
    return;
  }

  // Tabela Dia | Semana | No mês. No cartão largo ela fica à esquerda e o gráfico à direita.
  const xMes = largo ? x + 440 : x + w - 8;
  const xSem = xMes - 66;
  const xDia = xSem - 66;
  let y = topo - 32;
  if (!mensal) {
    textoDireita(p, 'DIA', xDia, y, 6.5, 'negrito', CINZA);
    textoDireita(p, 'SEMANA', xSem, y, 6.5, 'negrito', CINZA);
  }
  textoDireita(p, 'NO MÊS', xMes, y, 6.5, 'negrito', CINZA);
  y -= 6;
  p.linha(x + 8, y, xMes + 2, y, LINHA, 0.6);
  // Linhas no mesmo padrão da tabela de trilheiros: mais altas, números em negrito e faixas zebradas.
  // Nos cartões largos a linha é mais alta (padrão do trilheiro); no gerencial, mais compacta para caber na folha.
  const altLinhaSetor = largo ? 16 : 13;
  s.linhas.forEach((linha, i) => {
    y -= altLinhaSetor;
    if (i % 2 === 1) p.retangulo(x + 4, y - 4, w - 8, altLinhaSetor, ZEBRA);
    p.texto(linha.rotulo, x + 8, y, 8, 'normal', TINTA);
    if (!mensal) {
      valorDireitaComCores(p, linha.dia, linha.cores, xDia, y, 9, 'negrito', TINTA);
      valorDireitaComCores(p, linha.semana, linha.cores, xSem, y, 9, 'negrito', TINTA);
    }
    valorDireitaComCores(p, linha.mes, linha.cores, xMes, y, 9, 'negrito', hex(s.cor));
  });

  // No mensal o gráfico diário sai: o cartão mostra só os totais do mês.
  if (!s.grafico || mensal) return;
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
    // A área do gráfico termina abaixo da legenda (topo - 46): a barra mais alta nunca invade o cabeçalho do cartão.
    desenharGrafico(p, s.grafico, xg, base + 22, wg, Math.max(40, h - 74), rotulos);
    return;
  }
  // Gráfico da semana, na parte de baixo do cartão (abaixo da tabela)
  const yLegenda = base + 4;
  let lx = x + 8;
  for (const serie of s.grafico.series) {
    p.retangulo(lx, yLegenda, 6, 6, hex(serie.cor));
    p.texto(serie.nome, lx + 9, yLegenda, 6.5, 'normal', CINZA);
    lx += 9 + larguraTexto(serie.nome, 6.5) + 14;
  }
  // Sem título próprio: a legenda já diz as séries, e o gráfico fica abaixo da tabela.
  desenharGrafico(p, s.grafico, x + 8, base + 30, w - 16, 22, rotulos);
}

/** Cartão do topo (Do dia, Da semana, No mês) em três linhas iguais: rótulo à esquerda, valor à direita. */
export function desenharResumoCartao(p: PaginaPdf, r: { rotulo: string; cor: string; dia: string; semana: string; mes: string }, x: number, topo: number, w: number, altura: number) {
  p.arredondado(x + 1, topo - altura - 1.2, w, altura, 9, SOMBRA);
  p.arredondado(x, topo - altura, w, altura, 9, BRANCO, LINHA);
  p.arredondado(x + 8, topo - 15, 6, 6, 3, hex(r.cor));
  p.texto(r.rotulo.toUpperCase(), x + 18, topo - 14, 7, 'negrito', TINTA);
  const linhas: [string, string, ReturnType<typeof hex>][] = [
    ['Do dia', r.dia, TINTA],
    ['Da semana', r.semana, hex(r.cor)],
    ['No mês', r.mes, hex(r.cor)],
  ];
  linhas.forEach(([rot, val, cor], k) => {
    const yLinha = topo - 27 - k * 13;
    if (k > 0) p.linha(x + 8, yLinha + 9, x + w - 8, yLinha + 9, LINHA, 0.4);
    p.texto(rot, x + 8, yLinha, 7, 'normal', CINZA);
    textoDireita(p, val, x + w - 8, yLinha, 8.5, 'negrito', cor);
  });
}

export function gerarOnePageUsinaPdf(d: DadosRelatorio, tril: TrilheirosRelatorio, modo: 'semanal' | 'mensal' = 'semanal'): Buffer {
  const mensal = modo === 'mensal';
  const p = new PaginaPdf();
  p.retangulo(0, 0, L, H, BRANCO);
  // Faixa de marca no topo
  p.retangulo(0, H - 5, L, 5, NAVY);
  p.retangulo(0, H - 5, L * 0.35, 5, AZUL);

  // Cabeçalho
  p.texto('CONTROLE DE TRILHOS', M, H - 26, 7.5, 'negrito', AZUL);
  p.texto('Relatório gerencial', M, H - 52, 21, 'negrito', TINTA);
  const semana = mensal ? `Mês até ${mesAte(d.data).split(' a ')[1]}` : faixaSemanaSegSex(d.data);
  const wPilula = larguraTexto(semana, 10, 'negrito') + 26;
  p.arredondado(L - M - wPilula, H - 54, wPilula, 22, 11, hex('#e9f1fb'));
  textoDireita(p, semana, L - M - 13, H - 47, 10, 'negrito', NAVY);
  textoDireita(p, mensal ? 'MENSAL' : 'SEGUNDA A DOMINGO', L - M, H - 26, 7, 'negrito', CINZA);
  p.linha(M, H - 62, L - M, H - 62, LINHA, 0.8);

  // Resumo: dia e semana separados em cada setor
  const gap = 10;
  const wRes = (L - 2 * M - (d.resumo.length - 1) * gap) / d.resumo.length;
  const topoRes = H - 70;
  const altRes = 64;
  d.resumo.forEach((r, i) => {
    const x = M + i * (wRes + gap);
    p.arredondado(x + 1, topoRes - altRes - 1.2, wRes, altRes, 9, SOMBRA);
    p.arredondado(x, topoRes - altRes, wRes, altRes, 9, BRANCO, LINHA);
    p.arredondado(x + 8, topoRes - 15, 6, 6, 3, hex(r.cor));
    p.texto(r.rotulo.toUpperCase(), x + 18, topoRes - 14, 7, 'negrito', TINTA);
    if (mensal) {
      p.texto('No mês', x + 8, topoRes - 30, 6.5, 'normal', CINZA);
      p.texto(r.mes, x + 8, topoRes - 46, 14, 'negrito', hex(r.cor));
      return;
    }
    // Três linhas iguais: rótulo à esquerda, valor à direita, mesmo tamanho e a mesma ordem em todos os cartões.
    const linhasRes: [string, string, ReturnType<typeof hex>][] = [
      ['Do dia', r.dia, TINTA],
      ['Da semana', r.semana, hex(r.cor)],
      ['No mês', r.mes, hex(r.cor)],
    ];
    linhasRes.forEach(([rot, val, cor], k) => {
      const yLinha = topoRes - 27 - k * 13;
      if (k > 0) p.linha(x + 8, yLinha + 9, x + wRes - 8, yLinha + 9, LINHA, 0.4);
      p.texto(rot, x + 8, yLinha, 7, 'normal', CINZA);
      textoDireita(p, val, x + wRes - 8, yLinha, 8.5, 'negrito', cor);
    });
  });

  // Linha 1: Estaleiro, Geração e Recolhimento serra, lado a lado.
  const colunas = 3;
  const gapC = 12;
  const wSet = (L - 2 * M - (colunas - 1) * gapC) / colunas;
  const altSet = 166;
  const topoGrade = topoRes - altRes - 16;
  const porTitulo = (t: string) => d.setores.find((s) => s.titulo === t);
  const linha1 = d.setores.filter((s) => s.titulo !== 'Caminhão de solda' && s.titulo !== 'Trilheiros');
  linha1.slice(0, colunas).forEach((s, i) => {
    desenharSetor(p, s, M + i * (wSet + gapC), topoGrade, wSet, altSet, false, d.rotulosDias, mensal);
  });

  // Linhas 2 e 3: Caminhão de solda e Trilheiros, um embaixo do outro, cada um na largura toda.
  const larguraTotal = L - 2 * M;
  const altCaminhao = 92;
  const gapLinha = 6;
  const topoLinha2 = topoGrade - altSet - 12;
  const caminhao = porTitulo('Caminhão de solda');
  if (caminhao) desenharSetor(p, caminhao, M, topoLinha2, larguraTotal, altCaminhao, true, d.rotulosDias, mensal);
  // Trilheiros: a mesma tabela do PDF por setor, em versão compacta.
  const altTrilheiros = Math.max(90, 46 + Math.max(1, tril.equipes.length) * 28 + 6);
  desenharTrilheiros(p, tril, M, topoLinha2 - altCaminhao - gapLinha, larguraTotal, altTrilheiros, true);

  const emitido = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  p.linha(M, 30, L - M, 30, LINHA, 0.6);
  p.texto(`Emitido em ${emitido}`, M, 18, 6.5, 'normal', CINZA);
  textoDireita(p, 'Controle de Trilhos · Usina', L - M, 18, 6.5, 'negrito', CINZA);

  return montarPdfVarias([p], `Relatório gerencial usina ${d.data}`, A4_PAISAGEM);
}
