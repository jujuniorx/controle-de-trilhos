import { PaginaPdf, A4_PAISAGEM, montarPdfVarias, larguraTexto } from '@/lib/pdf/simples';
import type { DadosRelatorio, GraficoRelatorio, SerraRelatorio, SetorRelatorio, TrilheirosRelatorio } from '@/lib/services/onePageUsina';
import { faixaSemanaSegSex, mesAte, rotuloPeriodo, type Coluna, TODAS_COLUNAS } from '@/lib/usina/periodo';
import { desenharTrilheiros } from '@/lib/pdf/tabelaTrilheiros';
import { desenharCaminhoes } from '@/lib/pdf/tabelaCaminhoes';

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
function desenharTabelaSerra(p: PaginaPdf, serra: SerraRelatorio, x: number, topo: number, w: number, colunas: Coluna[] = TODAS_COLUNAS) {
  const colunaRotulo = 42;
  const colW = (w - colunaRotulo - 12) / 6;
  // Borda direita de cada coluna (barras e metros de Dia, Semana e Mês), encostadas à direita.
  const todosGrupos: { rotulo: string; chave: 'dia' | 'semana' | 'mes' }[] = [
    { rotulo: 'DIA', chave: 'dia' },
    { rotulo: 'SEMANA', chave: 'semana' },
    { rotulo: 'NO MÊS', chave: 'mes' },
  ];
  const grupos = todosGrupos.filter((g) => colunas.includes(g.chave));
  const fim = (c: number) => x + colunaRotulo + (c + 1) * colW - 4;
  const fimG = (gi: number, sub: 0 | 1) => fim(6 - 2 * grupos.length + gi * 2 + sub);
  // Caixa por coluna (Dia, Semana, No mês), igual aos cartões de estaleiro e geração: cobre o cabeçalho até a última linha.
  const baseCaixa = topo - 32 - 9 - 5 - 11 * (serra.linhas.length + 1) - 6;
  grupos.forEach((g, gi) => {
    // Caixas com folga entre elas: cada grupo ocupa duas colunas, e a caixa seguinte começa depois de 6pt.
    const x0 = fimG(gi, 0) - colW + 6;
    const x1 = fimG(gi, 1) + 3;
    p.arredondado(x0, baseCaixa, x1 - x0, topo - 26 - baseCaixa, 4, g.chave === 'mes' ? hex('#f1f5f9') : BRANCO, LINHA);
  });
  let y = topo - 32;
  grupos.forEach((g, gi) => textoDireita(p, g.rotulo, fimG(gi, 1), y, 6.5, 'negrito', CINZA));
  y -= 9;
  grupos.forEach((_, gi) => {
    textoDireita(p, 'Barras', fimG(gi, 0), y, 6, 'negrito', CINZA);
    textoDireita(p, 'Metros', fimG(gi, 1), y, 6, 'negrito', CINZA);
  });
  y -= 5;
  p.linha(x + 8, y, x + w - 8, y, LINHA, 0.6);
  const medidas = (m: { barras: number; metros: number }, gi: number, cor: Cor) => {
    textoDireita(p, String(m.barras), fimG(gi, 0), y, 8.5, 'negrito', cor);
    textoDireita(p, fmtMetrosPdf(m.metros), fimG(gi, 1), y, 8.5, 'negrito', cor);
  };
  serra.linhas.forEach((l, i) => {
    y -= 11;
    // Sem zebra quando há caixas de coluna (a zebra aparecia cortada nas bordas das caixas).
    if (grupos.length === 0 && i % 2 === 1) p.retangulo(x + 4, y - 3, w - 8, 11, ZEBRA);
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

export function desenharSetor(p: PaginaPdf, s: SetorRelatorio, x: number, topo: number, w: number, h: number, largo = false, rotulos: string[] = [], mensal = false, colunas: Coluna[] = ['dia', 'semana', 'mes'], comGrafico = true) {
  const base = topo - h;
  p.arredondado(x + 1.2, base - 1.4, w, h, 9, SOMBRA);
  p.arredondado(x, base, w, h, 9, BRANCO, LINHA);
  p.arredondado(x, topo - 22, w, 22, 9, hex(s.cor));
  p.retangulo(x, topo - 22, w, 8, hex(s.cor));
  p.texto(s.titulo.toUpperCase(), x + 8, topo - 14, 8, 'negrito', BRANCO);
  if (s.serra) {
    desenharTabelaSerra(p, s.serra, x, topo, w, mensal ? ['mes'] : colunas);
    if (s.grafico && comGrafico) {
      desenharGrafico(p, s.grafico, x + 8, base + 30, w - 16, 22, rotulos);
    }
    return;
  }

  // Tabela: só as colunas escolhidas (Dia, Semana, No mês), cada uma numa caixa própria.
  // No cartão largo a tabela fica à esquerda e o gráfico à direita.
  const ativas = (['dia', 'semana', 'mes'] as Coluna[]).filter((c) => colunas.includes(c) && (!mensal || c === 'mes'));
  // A caixa da última coluna avança 8pt à direita do alinhamento dos valores; com 16pt de recuo ela fica 10pt dentro do cartão.
  const xMes = largo ? x + 440 : x + w - 16;
  const passo = 66;
  // Borda direita de cada coluna: a última ativa encosta em xMes e as anteriores andam para a esquerda.
  const xDe = (c: Coluna) => xMes - (ativas.length - 1 - ativas.indexOf(c)) * passo;
  const nomeDe: Record<Coluna, string> = { dia: 'DIA', semana: 'SEMANA', mes: 'NO MÊS' };
  // Linhas no padrão da tabela de trilheiros: mais altas no cartão largo; mais compactas no gerencial.
  const altLinhaSetor = largo ? 16 : 13;
  const yCabecalho = topo - 32;
  const yPrimeiraLinha = topo - 38;
  // A caixa desce abaixo da última linha de texto: sem essa folga, os números da última linha passavam da borda.
  const fimLinhas = yPrimeiraLinha - s.linhas.length * altLinhaSetor - 9;
  // Faixas zebradas primeiro; depois as caixas das colunas, por cima; por fim os textos.
  // Com as caixas das colunas, a zebra some: ela aparecia cortada nas bordas das caixas e deixava o cartão quebrado.
  if (ativas.length === 0) {
    s.linhas.forEach((_, i) => {
      if (i % 2 === 1) p.retangulo(x + 4, yPrimeiraLinha - (i + 1) * altLinhaSetor - 4, w - 8, altLinhaSetor, ZEBRA);
    });
  }
  ativas.forEach((c) => {
    const xr = xDe(c);
    p.arredondado(xr - 52, fimLinhas, 60, topo - 26 - fimLinhas, 4, c === 'mes' ? hex('#f1f5f9') : BRANCO, LINHA);
  });
  ativas.forEach((c) => textoDireita(p, nomeDe[c], xDe(c), yCabecalho, 6.5, 'negrito', CINZA));
  p.linha(x + 8, yPrimeiraLinha - 6, xMes + 2, yPrimeiraLinha - 6, LINHA, 0.6);
  let y = yPrimeiraLinha - 6;
  s.linhas.forEach((linha) => {
    y -= altLinhaSetor;
    p.texto(linha.rotulo, x + 8, y, 8, 'normal', TINTA);
    ativas.forEach((c) => {
      const valor = c === 'dia' ? linha.dia : c === 'semana' ? linha.semana : linha.mes;
      valorDireitaComCores(p, valor, linha.cores, xDe(c), y, 9, 'negrito', c === 'mes' ? hex(s.cor) : TINTA);
    });
  });

  // No mensal o gráfico diário sai: o cartão mostra só os totais do mês.
  if (!s.grafico || mensal || !comGrafico) return;
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
export function desenharResumoCartao(p: PaginaPdf, r: { rotulo: string; cor: string; dia: string; semana: string; mes: string; linhas?: { rotulo: string; valor: string }[] }, x: number, topo: number, w: number, altura: number, colunas: Coluna[] = TODAS_COLUNAS) {
  p.arredondado(x + 1, topo - altura - 1.2, w, altura, 9, SOMBRA);
  p.arredondado(x, topo - altura, w, altura, 9, BRANCO, LINHA);
  p.arredondado(x + 8, topo - 15, 6, 6, 3, hex(r.cor));
  p.texto(r.rotulo.toUpperCase(), x + 18, topo - 14, 7, 'negrito', TINTA);
  desenharLinhasResumo(p, r, x, topo, w, colunas);
}

/** Linhas de um cartão do topo: as três padrão (Do dia, Da semana, No mês) ou as linhas próprias do cartão (trilheiros). */
export function desenharLinhasResumo(p: PaginaPdf, r: { cor: string; dia: string; semana: string; mes: string; linhas?: { rotulo: string; valor: string }[] }, x: number, topo: number, w: number, colunas: Coluna[] = TODAS_COLUNAS, rotuloDia = 'Do dia') {
  const padrao: { c: Coluna; rot: string; val: string; cor: ReturnType<typeof hex> }[] = [
    { c: 'dia', rot: rotuloDia, val: r.dia, cor: TINTA },
    { c: 'semana', rot: 'Da semana', val: r.semana, cor: hex(r.cor) },
    { c: 'mes', rot: 'No mês', val: r.mes, cor: hex(r.cor) },
  ];
  const linhas: [string, string, ReturnType<typeof hex>][] = r.linhas && r.linhas.length > 0
    ? r.linhas.map((l) => [l.rotulo, l.valor, hex(r.cor)])
    : padrao.filter((l) => colunas.includes(l.c)).map((l) => [l.rot, l.val, l.cor]);
  linhas.forEach(([rot, val, cor], k) => {
    const yLinha = topo - 27 - k * 13;
    if (k > 0) p.linha(x + 8, yLinha + 9, x + w - 8, yLinha + 9, LINHA, 0.4);
    p.texto(rot, x + 8, yLinha, 7, 'normal', CINZA);
    textoDireita(p, val, x + w - 8, yLinha, 8.5, 'negrito', cor);
  });
}

export function gerarOnePageUsinaPdf(d: DadosRelatorio, tril: TrilheirosRelatorio, modo: 'semanal' | 'mensal' | 'diario' = 'semanal', colunasEscolhidas: Coluna[] = TODAS_COLUNAS, observacoes: string[] = []): Buffer {
  const mensal = modo === 'mensal';
  const diario = modo === 'diario';
  // As colunas são as escolhidas pelo usuário (Dia, Semana, No mês). No diário o gráfico de 7 dias sai, porque ele é da semana.
  const colunas = colunasEscolhidas;
  const p = new PaginaPdf();
  p.retangulo(0, 0, L, H, BRANCO);
  // Faixa de marca no topo
  p.retangulo(0, H - 5, L, 5, NAVY);
  p.retangulo(0, H - 5, L * 0.35, 5, AZUL);

  // Cabeçalho
  p.texto('CONTROLE DE TRILHOS', M, H - 26, 7.5, 'negrito', AZUL);
  p.texto('Relatório gerencial', M, H - 52, 21, 'negrito', TINTA);
  const semana = mensal ? `Mês até ${mesAte(d.data).split(' a ')[1]}` : diario ? rotuloPeriodo(d.data, 'diario').valor : faixaSemanaSegSex(d.data);
  const wPilula = larguraTexto(semana, 10, 'negrito') + 26;
  p.arredondado(L - M - wPilula, H - 54, wPilula, 22, 11, hex('#e9f1fb'));
  textoDireita(p, semana, L - M - 13, H - 47, 10, 'negrito', NAVY);
  textoDireita(p, mensal ? 'MENSAL' : diario ? 'DIÁRIO' : 'SEGUNDA A DOMINGO', L - M, H - 26, 7, 'negrito', CINZA);
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
    if (mensal && r.linhas?.length) {
      desenharLinhasResumo(p, r, x, topoRes, wRes, colunas, d.rotuloDia);
      return;
    }
    if (mensal) {
      p.texto('No mês', x + 8, topoRes - 30, 6.5, 'normal', CINZA);
      p.texto(r.mes, x + 8, topoRes - 46, 14, 'negrito', hex(r.cor));
      return;
    }
    // Três linhas iguais: rótulo à esquerda, valor à direita, mesmo tamanho e a mesma ordem em todos os cartões.
    desenharLinhasResumo(p, r, x, topoRes, wRes, colunas, d.rotuloDia);
  });

  // Linha 1: Estaleiro, Geração e Recolhimento serra, lado a lado.
  const nSetores = 3;
  const gapC = 12;
  const wSet = (L - 2 * M - (nSetores - 1) * gapC) / nSetores;
  const altSet = 166;
  const topoGrade = topoRes - altRes - 16;
  const porTitulo = (t: string) => d.setores.find((s) => s.titulo === t);
  const linha1 = d.setores.filter((s) => s.titulo !== 'Caminhão de solda' && s.titulo !== 'Trilheiros');
  linha1.slice(0, nSetores).forEach((s, i) => {
    desenharSetor(p, s, M + i * (wSet + gapC), topoGrade, wSet, altSet, false, d.rotulosDias, mensal, colunas, !diario);
  });

  // Linhas 2 e 3: Caminhão de solda e Trilheiros, um embaixo do outro, cada um na largura toda.
  const larguraTotal = L - 2 * M;
  // Altura do cartão do caminhão cresce com o número de linhas (Solda e Corte de cada caminhão), para nada passar por baixo.
  const linhasCaminhao = porTitulo('Caminhão de solda')?.caminhoes?.length ?? 0;
  const altCaminhao = Math.max(90, 50 + linhasCaminhao * 40);
  const gapLinha = 6;
  const topoLinha2 = topoGrade - altSet - 12;
  const caminhao = porTitulo('Caminhão de solda');
  // Caminhão no mesmo formato da tabela de trilheiros (sem gráfico, como no trilheiro).
  if (caminhao?.caminhoes) desenharCaminhoes(p, caminhao.caminhoes, caminhao.cor, M, topoLinha2, larguraTotal, altCaminhao, mensal ? 'mensal' : 'semanal', colunas);
  // Trilheiros: a mesma tabela do PDF por setor, em versão compacta.
  const altTrilheiros = Math.max(90, 46 + Math.max(1, tril.equipes.length) * 28 + 6);
  const topoTrilheiros = topoLinha2 - altCaminhao - gapLinha;
  desenharTrilheiros(p, tril, M, topoTrilheiros, larguraTotal, altTrilheiros, true);

  // Observações do dia (só no diário), embaixo dos trilheiros, nas linhas que cabem.
  if (diario && observacoes.length > 0) {
    const sobra = topoTrilheiros - altTrilheiros - 42;
    const linhasQueCabem = Math.max(0, Math.min(observacoes.length, Math.floor((sobra - 24) / 11)));
    if (linhasQueCabem > 0) {
      const altObs = 24 + linhasQueCabem * 11;
      const baseObs = topoTrilheiros - altTrilheiros - 8 - altObs;
      p.arredondado(M, baseObs, larguraTotal, altObs, 9, BRANCO, LINHA);
      p.texto('OBSERVAÇÕES DO DIA', M + 10, baseObs + altObs - 13, 7, 'negrito', CINZA);
      observacoes.slice(0, linhasQueCabem).forEach((linha, i) => p.texto(linha, M + 10, baseObs + altObs - 26 - i * 11, 8, 'normal', TINTA));
    }
  }

  const emitido = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  p.linha(M, 30, L - M, 30, LINHA, 0.6);
  p.texto(`Emitido em ${emitido}`, M, 18, 6.5, 'normal', CINZA);
  textoDireita(p, 'Controle de Trilhos · Usina', L - M, 18, 6.5, 'negrito', CINZA);

  return montarPdfVarias([p], `Relatório gerencial usina ${d.data}`, A4_PAISAGEM);
}
