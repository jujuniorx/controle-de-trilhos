import { PaginaPdf, A4_PAISAGEM, montarPdfVarias, larguraTexto, quebrarLinhas, criarImagemPdf } from '@/lib/pdf/simples';
import { LOGO_RUMO } from '@/lib/pdf/logoRumo';
import { BANNER_RELATORIO } from '@/lib/pdf/bannerRelatorio';

/** Logo da Rumo, decodificada uma vez (PDF com imagem RGB comprimida). */
const logoRumo = criarImagemPdf(LOGO_RUMO.largura, LOGO_RUMO.altura, Buffer.from(LOGO_RUMO.dados, 'base64'));
/** Foto dos setores (JPEG), usada na capa do PDF. */
const bannerRelatorio = criarImagemPdf(BANNER_RELATORIO.largura, BANNER_RELATORIO.altura, Buffer.from(BANNER_RELATORIO.dados, 'base64'), 'DCTDecode');
import type { DadosRelatorio, GraficoRelatorio, LinhaRelatorio, SerraRelatorio, SetorRelatorio, TrilheirosRelatorio } from '@/lib/services/onePageUsina';
import { faixaSemanaSegSex, mesAte, rotuloPeriodo, type Coluna, TODAS_COLUNAS } from '@/lib/usina/periodo';
import { desenharTrilheiros } from '@/lib/pdf/tabelaTrilheiros';
import { desenharCaminhoes, alturaCaminhoes } from '@/lib/pdf/tabelaCaminhoes';

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
  p.texto(texto, xDireita, y, tamanho, fonte, c, 'fim');
}

/** Texto centralizado em xCentro. */
function textoCentro(p: PaginaPdf, texto: string, xCentro: number, y: number, tamanho: number, fonte: 'normal' | 'negrito', c: Cor) {
  p.texto(texto, xCentro, y, tamanho, fonte, c, 'meio');
}

/** Valor em cima da barra: inteiro sem casas; com fração, duas casas (como nas tabelas). */
function fmtValorBarra(v: number): string {
  const inteiro = Number.isInteger(v);
  return v.toLocaleString('pt-BR', { minimumFractionDigits: inteiro ? 0 : 2, maximumFractionDigits: inteiro ? 0 : 2 });
}

/** Valor centralizado em xCentro com partes separadas por ' / ', cada parte na sua cor. */
function valorCentroComCores(p: PaginaPdf, valor: string, cores: string[] | undefined, xCentro: number, y: number, tamanho: number, fonte: 'normal' | 'negrito', corPadrao: Cor) {
  const partes = valor.split(' / ');
  if (!cores || partes.length !== cores.length) {
    textoCentro(p, valor, xCentro, y, tamanho, fonte, corPadrao);
    return;
  }
  let total = 0;
  partes.forEach((pt, i) => {
    total += larguraTexto(pt, tamanho, fonte);
    if (i < partes.length - 1) total += larguraTexto(' / ', tamanho, fonte);
  });
  let x = xCentro - total / 2;
  partes.forEach((pt, i) => {
    p.texto(pt, x, y, tamanho, fonte, hex(cores[i]!));
    x += larguraTexto(pt, tamanho, fonte);
    if (i < partes.length - 1) {
      p.texto(' / ', x, y, tamanho, fonte, CINZA);
      x += larguraTexto(' / ', tamanho, fonte);
    }
  });
}

/** Tabela da serra: W61 e W62 nas linhas; Dia, Semana e Mês com barras e metros, cada composição na sua cor. */
function desenharTabelaSerra(p: PaginaPdf, serra: SerraRelatorio, x: number, topo: number, w: number, colunas: Coluna[] = TODAS_COLUNAS, rotuloDia = 'DIA') {
  const todosGrupos: { rotulo: string; chave: 'dia' | 'semana' | 'mes' }[] = [
    { rotulo: rotuloDia, chave: 'dia' },
    { rotulo: 'SEMANA', chave: 'semana' },
    { rotulo: 'NO MÊS', chave: 'mes' },
  ];
  const grupos = todosGrupos.filter((g) => colunas.includes(g.chave));
  // Uma caixa por grupo (Dia, Semana, No mês), com Barras e Metros dentro. A última caixa termina na mesma
  // borda direita dos outros cartões (8pt antes da borda), e as caixas têm o mesmo espaço entre elas.
  const larguraCaixa = 62;
  const passo = 68;
  const direita = x + w - 8;
  const x0De = (gi: number) => direita - (grupos.length - gi) * passo + (passo - larguraCaixa);
  const centroBarras = (gi: number) => x0De(gi) + larguraCaixa * 0.27;
  const centroMetros = (gi: number) => x0De(gi) + larguraCaixa * 0.72;
  // A caixa desce até logo abaixo da linha do Total (a linha do Total fica em topo - 55 - 11 x (linhas + 1)).
  const baseCaixa = topo - 55 - 11 * (serra.linhas.length + 1) - 4;
  const yLinha = topo - 55;
  // A linha do cabeçalho vem antes das caixas: elas a cobrem, e a linha não corta as colunas.
  p.linha(x + 8, yLinha, direita, yLinha, LINHA, 0.6);
  grupos.forEach((g, gi) => {
    p.arredondado(x0De(gi), baseCaixa, larguraCaixa, topo - 26 - baseCaixa, 4, g.chave === 'mes' ? hex('#f1f5f9') : BRANCO, LINHA);
  });
  let y = topo - 34;
  grupos.forEach((g, gi) => textoCentro(p, g.rotulo, x0De(gi) + larguraCaixa / 2, y, 6.5, 'negrito', CINZA));
  y -= 8;
  grupos.forEach((_, gi) => {
    textoCentro(p, 'Barras', centroBarras(gi), y, 6, 'negrito', CINZA);
    // "Metros" e "est." em duas linhas, para não encostar em "Barras".
    textoCentro(p, 'Metros', centroMetros(gi), y, 6, 'negrito', CINZA);
    textoCentro(p, '(est.)', centroMetros(gi), y - 6.5, 6, 'negrito', CINZA);
  });
  y = yLinha;
  const medidas = (m: { barras: number; metros: number }, gi: number, cor: Cor) => {
    textoCentro(p, String(m.barras), centroBarras(gi), y, 8.5, 'negrito', cor);
    textoCentro(p, fmtMetrosPdf(m.metros), centroMetros(gi), y, 8.5, 'negrito', cor);
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

/** Linhas de grade do gráfico: mais claras que as linhas dos cartões, para ficarem atrás das barras. */
const GRADE: Cor = [0.91, 0.92, 0.94];

/** Escala do eixo: 4 ou 5 passos redondos (1, 2, 2,5 ou 5 vezes 10^k) cobrindo o maior valor. */
function passosDaEscala(maior: number): { topo: number; marcas: number[] } {
  if (maior <= 0) return { topo: 10, marcas: [0, 5, 10] };
  const bruto = maior / 4;
  const ordem = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((f) => f * ordem).find((c) => c >= bruto) ?? 10 * ordem;
  const topo = Math.ceil(maior / passo) * passo;
  const marcas: number[] = [];
  for (let m = 0; m <= topo + passo / 2; m += passo) marcas.push(Math.round(m * 100) / 100);
  return { topo, marcas };
}

/** Número da escala: sem casas quando inteiro, como no Excel (0, 100, 200; 0, 2,5, 5). */
function fmtEscala(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

/** Gráfico de barras por dia: uma barra por série e por dia, na área (x, yBase) até (x+w, yBase+altura). */
export function desenharGrafico(p: PaginaPdf, g: GraficoRelatorio, x: number, yBase: number, w: number, altura: number, rotulos: string[] = [], bwMax = 4, destaque?: number | number[], comValores = false) {
  const n = Math.max(1, ...g.series.map((s) => s.valores.length));
  const maior = Math.max(0, ...g.series.flatMap((s) => s.valores));
  // Com valores: escala à esquerda e linhas de grade atrás das barras, como no Excel.
  // O topo da escala é o primeiro número redondo acima do maior valor da semana.
  // Semana sem lançamento fica sem escala: só o aviso, sem grade cortando o texto.
  const escala = comValores && maior > 0 ? passosDaEscala(maior) : null;
  const topo = escala ? escala.topo : Math.max(1, maior);
  // O número em cima da barra mais alta precisa de lugar: a barra para 9 pt antes do topo.
  const alturaBarras = comValores ? Math.max(6, altura - 9) : altura;
  if (escala) {
    const textos = escala.marcas.map(fmtEscala);
    const larguraEixo = Math.max(...textos.map((t) => larguraTexto(t, 5.5, 'normal'))) + 5;
    escala.marcas.forEach((m, k) => {
      const y = yBase + (m / topo) * alturaBarras;
      if (m > 0) p.linha(x + larguraEixo, y, x + w, y, GRADE, 0.4);
      textoDireita(p, textos[k]!, x + larguraEixo - 3, y - 2, 5.5, 'normal', CINZA);
    });
    x += larguraEixo;
    w -= larguraEixo;
  }
  const gw = w / n;
  // Com valores, série sem nenhum lançamento na semana não ocupa lugar: as barras ficam mais largas.
  // A legenda continua mostrando todas as séries.
  const comLancamento = g.series.filter((s) => s.valores.some((v) => v > 0));
  const series = comValores && comLancamento.length > 0 ? comLancamento : g.series;
  const bw = Math.max(0.6, Math.min(bwMax, (gw * 0.75) / series.length));
  const larguraBarra = bw * 0.9;
  const semDados = g.series.every((s) => s.valores.every((v) => v <= 0));
  series.forEach((s, si) => {
    s.valores.forEach((v, i) => {
      const h = (Math.max(0, v) / topo) * alturaBarras;
      if (h <= 0) return;
      const bx = x + i * gw + gw / 2 - (series.length * bw) / 2 + si * bw;
      // Todos os dias mantêm a cor da série; o dia escolhido se destaca pelo nome em negrito.
      p.retangulo(bx, yBase, larguraBarra, h, hex(s.cor));
      if (comValores) textoCentro(p, fmtValorBarra(v), bx + larguraBarra / 2, yBase + h + 2.5, 5.5, 'negrito', TINTA);
    });
  });
  p.linha(x, yBase, x + w, yBase, LINHA, 0.6);
  // Semana sem nenhum lançamento: um aviso no lugar do gráfico vazio.
  if (comValores && semDados) textoCentro(p, 'Sem lançamentos nesta semana', x + w / 2, yBase + altura / 2 - 2, 7, 'normal', CINZA);
  // Nome do dia (Seg 19, Ter 20...) embaixo de cada grupo de barras.
  const yRotulo = yBase - 9;
  rotulos.forEach((r, i) => {
    const cx = x + i * gw + gw / 2;
    const dest = Array.isArray(destaque) ? destaque.includes(i) : destaque === i;
    textoCentro(p, r, cx, yRotulo, 6, dest ? 'negrito' : 'normal', destaque === undefined || dest ? CINZA : hex('#aaaaaa'));
    // Motivo do dia sem produção (Feriado, Folga) numa etiqueta logo abaixo do nome do dia, no lugar da barra vazia.
    const etiqueta = g.etiquetas?.[i];
    if (etiqueta) {
      const lt = larguraTexto(etiqueta, 5);
      p.arredondado(cx - lt / 2 - 3, yRotulo - 9, lt + 6, 7, 3, hex('#eef2f6'));
      textoCentro(p, etiqueta, cx, yRotulo - 7, 5, 'normal', hex('#64748b'));
    }
  });
}

/**
 * Medidas comuns aos cartões do diário (estaleiro, geração e serra): a caixa de observação, a legenda, o eixo do
 * gráfico e o topo das barras ficam na mesma altura em todos, mesmo quando um cartão tem mais texto que o outro.
 */
export interface LayoutDiario { alturaCaixa: number; yGrafico: number; alturaGrafico: number }

/** Máximo de linhas da observação no cartão; o que passar termina em reticências. */
const MAX_LINHAS_OBS = 6;

/** Linhas da observação de um setor, já quebradas na largura da caixa. */
function linhasObservacao(s: SetorRelatorio, w: number): { linhas: string[]; temTexto: boolean } {
  const texto = s.observacao?.trim() ?? '';
  const trechos = texto ? texto.split('\n') : [s.rotuloColunaDia ? 'Sem observação registrada no período.' : 'Sem observação registrada neste dia.'];
  return { linhas: trechos.flatMap((t) => quebrarLinhas(t, 7, w - 24)), temTexto: !!texto };
}

/** Onde termina a tabela do cartão (y da borda de baixo das caixas de coluna). */
function fundoTabela(s: SetorRelatorio, topo: number): number {
  if (s.serra) return topo - 55 - 11 * (s.serra.linhas.length + 1) - 4;
  const slots = s.linhas.length + s.linhas.filter((l) => l.secao).length;
  return topo - 38 - slots * 13 - 13;
}

/** Calcula as medidas comuns para cartões com topo e altura dados. */
export function layoutDiario(setores: SetorRelatorio[], topo: number, h: number, w: number): LayoutDiario {
  const base = topo - h;
  const comGrafico = setores.filter((s) => s.grafico);
  const nLinhas = Math.min(MAX_LINHAS_OBS, Math.max(1, ...comGrafico.map((s) => linhasObservacao(s, w).linhas.length)));
  const alturaCaixa = 14 + nLinhas * 8;
  const yLegenda = base + 6 + alturaCaixa + 8;
  // Com etiquetas embaixo dos dias (Feriado, Folga), o eixo sobe um pouco para elas não encostarem na legenda.
  const temEtiqueta = comGrafico.some((s) => s.grafico!.etiquetas?.some(Boolean));
  const yGrafico = yLegenda + 24 + (temEtiqueta ? 7 : 0);
  // As barras terminam 10pt abaixo da tabela mais baixa entre os cartões.
  const limite = Math.min(...setores.map((s) => fundoTabela(s, topo))) - 10;
  return { alturaCaixa, yGrafico, alturaGrafico: Math.max(16, limite - yGrafico) };
}

/** Gráfico da semana (dia escolhido em destaque) com a observação do setor embaixo. Só no diário. */
function desenharObservacaoEGrafico(p: PaginaPdf, s: SetorRelatorio, x: number, base: number, w: number, rotulos: string[], destaque: number | number[] | undefined, layout: LayoutDiario) {
  if (!s.grafico) return;
  const { linhas: todas, temTexto } = linhasObservacao(s, w);
  const maxLinhas = Math.max(1, Math.floor((layout.alturaCaixa - 14) / 8));
  const linhas = todas.length > maxLinhas ? [...todas.slice(0, maxLinhas - 1), `${todas[maxLinhas - 1]!.replace(/\s+\S*$/, '')}…`] : todas;
  // Caixa com a mesma altura nos três cartões; o texto começa em cima, logo abaixo do rótulo.
  const caixaBase = base + 6;
  const caixaTopo = caixaBase + layout.alturaCaixa;
  p.arredondado(x + 6, caixaBase, w - 12, layout.alturaCaixa, 4, hex('#f8fafc'), LINHA);
  p.texto('OBSERVAÇÃO', x + 12, caixaTopo - 8, 5.5, 'negrito', CINZA);
  linhas.forEach((linha, i) => p.texto(linha, x + 12, caixaTopo - 17 - i * 8, 7, 'normal', temTexto ? TINTA : CINZA));
  const yLegenda = caixaTopo + 8;
  let lx = x + 8;
  for (const serie of s.grafico.series) {
    p.retangulo(lx, yLegenda, 6, 6, hex(serie.cor));
    p.texto(serie.nome, lx + 9, yLegenda, 6.5, 'normal', CINZA);
    lx += 9 + larguraTexto(serie.nome, 6.5) + 14;
  }
  desenharGrafico(p, s.grafico, x + 8, layout.yGrafico, w - 16, layout.alturaGrafico, rotulos, 20, destaque, true);
}

export function desenharSetor(p: PaginaPdf, s: SetorRelatorio, x: number, topo: number, w: number, h: number, largo = false, rotulos: string[] = [], mensal = false, colunas: Coluna[] = ['dia', 'semana', 'mes'], comGrafico = true, destaque?: number | number[], layout?: LayoutDiario) {
  const base = topo - h;
  // No diário o gráfico é da semana, com o dia escolhido em destaque; a observação fica embaixo da tabela.
  const diarioSetor = destaque !== undefined;
  // Sem medidas comuns (cartão sozinho), o cartão calcula as próprias.
  const medidas = layout ?? layoutDiario([s], topo, h, w);
  p.arredondado(x + 1.2, base - 1.4, w, h, 9, SOMBRA);
  p.arredondado(x, base, w, h, 9, BRANCO, LINHA);
  p.arredondado(x, topo - 22, w, 22, 9, hex(s.cor));
  p.retangulo(x, topo - 22, w, 8, hex(s.cor));
  // Os números da serra são estimados: a indicação fica na coluna Metros est.
  p.texto(s.titulo, x + 8, topo - 14, 8, 'negrito', BRANCO);
  if (s.serra) {
    desenharTabelaSerra(p, s.serra, x, topo, w, mensal ? ['mes'] : colunas, s.rotuloColunaDia);
    if (s.grafico && comGrafico) {
      if (diarioSetor) desenharObservacaoEGrafico(p, s, x, base, w, rotulos, destaque, medidas);
      else desenharGrafico(p, s.grafico, x + 8, base + 30, w - 16, 22, rotulos);
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
  const nomeDe: Record<Coluna, string> = { dia: s.rotuloColunaDia ?? 'DIA', semana: 'SEMANA', mes: 'NO MÊS' };
  // Linhas no padrão da tabela de trilheiros: mais altas no cartão largo; mais compactas no gerencial.
  const altLinhaSetor = largo ? 16 : 13;
  const yPrimeiraLinha = topo - 38;
  // Nome da coluna (DIA, NO MÊS) no meio, entre o topo da caixa (topo - 26) e a linha do cabeçalho (yPrimeiraLinha - 6).
  const yCabecalho = (topo - 26 + yPrimeiraLinha - 6) / 2 - 2.3;
  // A caixa desce abaixo da última linha de texto: sem essa folga, os números da última linha passavam da borda.
  // Cada bloco com título (ex.: Soldas e cortes) ocupa uma linha a mais, além das linhas de dados.
  const slots = s.linhas.length + s.linhas.filter((l) => l.secao).length;
  const fimLinhas = yPrimeiraLinha - slots * altLinhaSetor - 13;
  // Faixas zebradas primeiro; depois as caixas das colunas, por cima; por fim os textos.
  // Com as caixas das colunas, a zebra some: ela aparecia cortada nas bordas das caixas e deixava o cartão quebrado.
  if (ativas.length === 0) {
    s.linhas.forEach((_, i) => {
      if (i % 2 === 1) p.retangulo(x + 4, yPrimeiraLinha - (i + 1) * altLinhaSetor - 4, w - 8, altLinhaSetor, ZEBRA);
    });
  }
  // A linha do cabeçalho vem antes das caixas: elas a cobrem, e a linha não corta as colunas.
  p.linha(x + 8, yPrimeiraLinha - 6, xMes + 2, yPrimeiraLinha - 6, LINHA, 0.6);
  ativas.forEach((c) => {
    const xr = xDe(c);
    p.arredondado(xr - 52, fimLinhas, 60, topo - 26 - fimLinhas, 4, c === 'mes' ? hex('#f1f5f9') : BRANCO, LINHA);
  });
  ativas.forEach((c) => textoCentro(p, nomeDe[c], xDe(c) - 22, yCabecalho, 6.5, 'negrito', CINZA));
  let y = yPrimeiraLinha - 6;
  s.linhas.forEach((linha) => {
    if (linha.secao) {
      y -= altLinhaSetor;
      // O título do bloco fica mais perto das linhas dele do que da linha de cima.
      p.texto(linha.secao.toUpperCase(), x + 8, y - 1, 6, 'negrito', CINZA);
    }
    y -= altLinhaSetor;
    p.texto(linha.rotulo, x + 8, y, 8, 'normal', TINTA);
    ativas.forEach((c) => {
      const valor = c === 'dia' ? linha.dia : c === 'semana' ? linha.semana : linha.mes;
      valorCentroComCores(p, valor, linha.cores, xDe(c) - 22, y, 9, 'negrito', c === 'mes' ? hex(s.cor) : TINTA);
    });
  });

  // No mensal o gráfico diário sai: o cartão mostra só os totais do mês.
  if (!s.grafico || mensal || !comGrafico) return;
  if (diarioSetor && !largo) {
    desenharObservacaoEGrafico(p, s, x, base, w, rotulos, destaque, medidas);
    return;
  }
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
    desenharGrafico(p, s.grafico, xg, base + 22, wg, Math.max(40, h - 74), rotulos, 4, destaque);
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
  desenharGrafico(p, s.grafico, x + 8, base + 30, w - 16, 22, rotulos, 4, destaque);
}

/** Cartão do topo (Do dia, Da semana, No mês) em três linhas iguais: rótulo à esquerda, valor à direita. */
export function desenharResumoCartao(p: PaginaPdf, r: { rotulo: string; cor: string; dia: string; semana: string; mes: string; linhas?: { rotulo: string; valor: string }[]; legenda?: string }, x: number, topo: number, w: number, altura: number, colunas: Coluna[] = TODAS_COLUNAS) {
  p.arredondado(x + 1, topo - altura - 1.2, w, altura, 9, SOMBRA);
  p.arredondado(x, topo - altura, w, altura, 9, BRANCO, LINHA);
  p.arredondado(x + 8, topo - 15, 6, 6, 3, hex(r.cor));
  p.texto(r.rotulo.toUpperCase(), x + 18, topo - 14, 7, 'negrito', TINTA);
  if (r.legenda) textoDireita(p, r.legenda, x + w - 8, topo - 14, 6, 'negrito', CINZA);
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

const CORES_SETOR_ESTALEIRO = '#2563eb';

/** Estoque de TLS no dia: uma coluna por tipo, numa faixa só, na largura toda. */
function desenharEstoqueTls(p: PaginaPdf, linhas: LinhaRelatorio[], x: number, topo: number, w: number, h: number, cor: string) {
  // A primeira linha da seção traz o rótulo "secao"; por isso filtra pelo perfil, não pela seção.
  const itens = linhas.filter((l) => l.perfil);
  const base = topo - h;
  p.arredondado(x + 1.2, base - 1.4, w, h, 9, SOMBRA);
  p.arredondado(x, base, w, h, 9, BRANCO, LINHA);
  p.arredondado(x, topo - 22, w, 22, 9, hex(cor));
  p.retangulo(x, topo - 22, w, 8, hex(cor));
  p.texto('Estoque de TLS', x + 10, topo - 14, 8, 'negrito', BRANCO);
  const meio = x + w / 2;
  p.linha(meio, base + 8, meio, topo - 30, LINHA, 0.6);
  desenharMeioTls(p, 'TLS', itens, x, w / 2, topo, (l) => l.malhas ?? ['—', '—', '—'], (l) => l.dia);
  desenharMeioTls(p, 'BARRAS CURTAS', itens, meio, w / 2, topo, (l) => l.curtaMalhas ?? ['—', '—', '—'], (l) => l.curtaTotal ?? '—');
}

/** Um dos dois quadros do estoque (TLS ou barras curtas): perfil, malha paulista, malha norte, FIPS e total, centralizados. */
function desenharMeioTls(
  p: PaginaPdf,
  titulo: string,
  itens: LinhaRelatorio[],
  x: number,
  w: number,
  topo: number,
  malhasDe: (l: LinhaRelatorio) => [string, string, string],
  totalDe: (l: LinhaRelatorio) => string,
) {
  const colunas = [x + 10, x + w * 0.34, x + w * 0.54, x + w * 0.74, x + w * 0.9];
  const centros = [0, (colunas[1]! + colunas[2]!) / 2, (colunas[2]! + colunas[3]!) / 2, (colunas[3]! + colunas[4]!) / 2, (colunas[4]! + x + w - 8) / 2];
  p.texto(titulo, x + 10, topo - 33, 7, 'negrito', TINTA);
  const yCab = topo - 44;
  ['Perfil', 'Malha Paulista', 'Malha Norte', 'FIPS', 'Total'].forEach((t, j) =>
    j === 0 ? p.texto(t, colunas[0]!, yCab, 6.5, 'negrito', CINZA) : textoCentro(p, t, centros[j]!, yCab, 6.5, 'negrito', CINZA),
  );
  p.linha(x + 8, yCab - 5, x + w - 8, yCab - 5, LINHA, 0.6);
  itens.forEach((l, i) => {
    const y = yCab - 17 - i * 13;
    p.texto(l.perfil ?? l.rotulo, colunas[0]!, y, 8, 'negrito', TINTA);
    const malhas = malhasDe(l);
    textoCentro(p, malhas[0], centros[1]!, y, 8, 'normal', TINTA);
    textoCentro(p, malhas[1], centros[2]!, y, 8, 'normal', TINTA);
    textoCentro(p, malhas[2], centros[3]!, y, 8, 'normal', TINTA);
    textoCentro(p, totalDe(l), centros[4]!, y, 9, 'negrito', TINTA);
  });
}

function montarPaginasUsina(d: DadosRelatorio, tril: TrilheirosRelatorio, modo: 'semanal' | 'mensal' | 'diario' = 'semanal', colunasEscolhidas: Coluna[] = TODAS_COLUNAS, observacoes: string[] = []): { capa: PaginaPdf; p: PaginaPdf; p2: PaginaPdf } {
  const mensal = modo === 'mensal';
  const diario = modo === 'diario';
  // As colunas são as escolhidas pelo usuário (Dia, Semana, No mês). No diário o gráfico de 7 dias sai, porque ele é da semana.
  const colunas = colunasEscolhidas;
  // No diário, o gráfico é da semana e os dias do relatório ficam em destaque (o resto em cinza).
  const indiceDia = d.diasDestaque.length ? d.diasDestaque : [(new Date(`${d.data}T12:00:00Z`).getUTCDay() + 6) % 7]; // 0 = segunda
  const rotulosGrafico = d.rotulosDias;
  // Observação do setor no dia (chave "AAAA-MM-DD|setor"), mostrada embaixo de cada cartão no diário.
  const chaveSetor: Record<string, string> = { 'Estaleiro de solda': 'estaleiro', 'Geração de trilho': 'geracao', 'Recolhimento serra': 'serra' };
  // Na foto, as equipes da geração aparecem como Equipe 1, 2 e 3 (o sistema continua mostrando os nomes).
  const EQUIPE_NA_FOTO: Record<string, string> = { Alécio: 'Equipe 1', Bruno: 'Equipe 2', Reginaldo: 'Equipe 3' };
  const equipesNaFoto = (t: string) => t.replace(/^(Alécio|Bruno|Reginaldo)( \([^)]*\))?:/gm, (_, nome: string, local: string | undefined) => `${EQUIPE_NA_FOTO[nome]}${local ?? ''}:`);
  const setoresBase = diario
    ? d.setores.map((s) => {
        // Preserva a observação que o setor já traz (equipes da geração, W61/W62 da serra); só usa a do setor se ele não tiver.
        const obs = s.observacao ?? (d.observacoes[`${d.data}|${chaveSetor[s.titulo] ?? ''}`] || undefined);
        return { ...s, observacao: s.titulo === 'Geração de trilho' && obs ? equipesNaFoto(obs) : obs };
      })
    : d.setores;
  // O estoque de TLS fica fora do relatorio por enquanto (desenharEstoqueTls guardada para voltar).
  const estaleiroBase = setoresBase.find((s) => s.titulo === 'Estaleiro de solda');
  const iTls = estaleiroBase ? estaleiroBase.linhas.findIndex((l) => l.secao?.startsWith('Estoque TLS')) : -1;
  const setores = setoresBase.map((s) => (s.titulo === 'Estaleiro de solda' && iTls >= 0 ? { ...s, linhas: s.linhas.slice(0, iTls) } : s));
  const p = new PaginaPdf();
  const p2 = new PaginaPdf();
  // Capa (página 1): foto dos setores em largura total, com o título e o período, como na tela.
  const capa = new PaginaPdf();
  capa.retangulo(0, 0, L, H, BRANCO);
  // Capa só com a foto inteira, sem cortar, em largura total e centralizada na folha.
  const larguraFoto = L - 2 * M;
  const alturaFoto = (larguraFoto * BANNER_RELATORIO.altura) / BANNER_RELATORIO.largura;
  capa.imagem(bannerRelatorio, M, (H - alturaFoto) / 2, larguraFoto, alturaFoto);
  p.retangulo(0, 0, L, H, BRANCO);
  // Faixa de marca no topo
  p.retangulo(0, H - 5, L, 5, NAVY);
  p.retangulo(0, H - 5, L * 0.35, 5, AZUL);

  // Sem cabeçalho repetido aqui (a capa já traz o título e a logo): só uma faixa separadora com o período.
  const semana = mensal ? `Mês até ${mesAte(d.data).split(' a ')[1]}` : diario ? rotuloPeriodo(d.data, 'diario', d.desde).valor : faixaSemanaSegSex(d.data);
  // Marca no topo à esquerda: CONTROLE DE TRILHOS | logo Rumo. O separador é uma barra fina no meio das maiúsculas,
  // com o mesmo espaço dos dois lados; a logo fica centrada na mesma altura do texto.
  const larguraMarca = larguraTexto('CONTROLE DE TRILHOS', 7, 'negrito');
  const altLogo = 10;
  const larguraLogo = (altLogo * LOGO_RUMO.largura) / LOGO_RUMO.altura;
  const centroTexto = H - 24 + 2.55; // meio das maiúsculas do texto (altura das maiúsculas da Helvetica = 0,72 em)
  const espacoMarca = 7;
  const xSeparador = M + larguraMarca + espacoMarca;
  p.texto('CONTROLE DE TRILHOS', M, H - 24, 7, 'negrito', AZUL);
  p.linha(xSeparador, centroTexto - 4, xSeparador, centroTexto + 4, LINHA, 0.9);
  p.imagem(logoRumo, xSeparador + espacoMarca, centroTexto - altLogo / 2, larguraLogo, altLogo);
  textoDireita(p, semana, L - M, H - 24, 9, 'negrito', NAVY);
  p.linha(M, H - 32, L - M, H - 32, LINHA, 0.8);

  // Resumo: dia e semana separados em cada setor
  const gap = 10;
  const wRes = (L - 2 * M - (d.resumo.length - 1) * gap) / d.resumo.length;
  const topoRes = H - 46;
  const altRes = 64;
  // Título de cada cartão sem a unidade; a unidade (und, m) vai à direita, pequena, como a legenda dos trilheiros.
  const cabecalhos = d.resumo.map((r) => {
    const m = r.rotulo.match(/^(.*?)\s*\((und|m)\)$/i);
    return { titulo: (m ? m[1]! : r.rotulo).toUpperCase(), legenda: r.legenda ?? (m ? m[2]!.toLowerCase() : '') };
  });
  // Todos os títulos no mesmo tamanho: o do título mais longo, para nenhum passar da borda (no máximo 7pt).
  const tamTitulo = Math.max(5, Math.min(7, ...cabecalhos.map((c) => {
    const espaco = wRes - 26 - (c.legenda ? larguraTexto(c.legenda, 6, 'negrito') + 6 : 0);
    return (7 * espaco) / Math.max(1, larguraTexto(c.titulo, 7, 'negrito'));
  })));
  d.resumo.forEach((r, i) => {
    const x = M + i * (wRes + gap);
    p.arredondado(x + 1, topoRes - altRes - 1.2, wRes, altRes, 9, SOMBRA);
    p.arredondado(x, topoRes - altRes, wRes, altRes, 9, BRANCO, LINHA);
    // Bolinha centrada na altura das maiúsculas do título.
    const yTitulo = topoRes - 14;
    const centroTitulo = yTitulo + tamTitulo * 0.36;
    p.arredondado(x + 8, centroTitulo - 3, 6, 6, 3, hex(r.cor));
    const { titulo, legenda } = cabecalhos[i]!;
    p.texto(titulo, x + 18, yTitulo, tamTitulo, 'negrito', TINTA);
    if (legenda) textoDireita(p, legenda, x + wRes - 8, yTitulo, 6, 'negrito', CINZA);
    if (mensal && r.linhas?.length) {
      desenharLinhasResumo(p, r, x, topoRes, wRes, colunas, diario ? d.rotuloValorDia : d.rotuloDia);
      return;
    }
    if (mensal) {
      p.texto('No mês', x + 8, topoRes - 30, 6.5, 'normal', CINZA);
      p.texto(r.mes, x + 8, topoRes - 46, 14, 'negrito', hex(r.cor));
      return;
    }
    // Três linhas iguais: rótulo à esquerda, valor à direita, mesmo tamanho e a mesma ordem em todos os cartões.
    desenharLinhasResumo(p, r, x, topoRes, wRes, colunas, diario ? d.rotuloValorDia : d.rotuloDia);
  });

  // Linha 1: Estaleiro, Geração e Recolhimento serra, lado a lado.
  const nSetores = 3;
  const gapC = 12;
  const wSet = (L - 2 * M - (nSetores - 1) * gapC) / nSetores;
  const topoGrade = topoRes - altRes - 16;
  const porTitulo = (t: string) => setores.find((s) => s.titulo === t);
  const linha1 = setores.filter((s) => s.titulo !== 'Caminhão de solda' && s.titulo !== 'Trilheiros').slice(0, nSetores);
  // No diário os três cartões usam as mesmas medidas (observação, legenda e gráfico na mesma altura).
  // Quando uma observação é longa, o cartão cresce em vez de espremer o gráfico.
  let altSet = 250;
  let layout: LayoutDiario | undefined;
  if (diario && !mensal) {
    const ALTURA_GRAFICO = 64;
    layout = layoutDiario(linha1, topoGrade, altSet, wSet);
    if (layout.alturaGrafico < ALTURA_GRAFICO) {
      altSet = Math.min(330, altSet + ALTURA_GRAFICO - layout.alturaGrafico);
      layout = layoutDiario(linha1, topoGrade, altSet, wSet);
    }
  }
  linha1.forEach((s, i) => {
    desenharSetor(p, s, M + i * (wSet + gapC), topoGrade, wSet, altSet, false, rotulosGrafico, mensal, colunas, true, diario ? indiceDia : undefined, layout);
  });

  // Linhas 2 e 3: Caminhão de solda e Trilheiros, um embaixo do outro, cada um na largura toda.
  const larguraTotal = L - 2 * M;
  // Altura do cartão do caminhão cresce com o número de linhas (Solda e Corte de cada caminhão), para nada passar por baixo.
  const linhasCaminhao = porTitulo('Caminhão de solda')?.caminhoes?.length ?? 0;
  const altCaminhao = alturaCaminhoes(linhasCaminhao);
  const gapLinha = 12; // mesmo espaço entre cartões da página, em toda a folha
  // Página 2: caminhão, trilheiros e observações. Página 1: setores e estoque TLS.
  const topoLinha2 = H - 46; // mesmo topo da primeira página (sem faixa em branco no começo da segunda)
  const caminhao = porTitulo('Caminhão de solda');
  // Caminhão no mesmo formato da tabela de trilheiros (sem gráfico, como no trilheiro).
  if (caminhao?.caminhoes) desenharCaminhoes(p2, caminhao.caminhoes, caminhao.cor, M, topoLinha2, larguraTotal, altCaminhao, mensal ? 'mensal' : 'semanal', colunas, caminhao.rotuloColunaDia);
  // Trilheiros: a mesma tabela do PDF por setor, em versão compacta.
  const altTrilheiros = Math.max(90, 46 + Math.max(1, tril.equipes.length) * 28 + 6);
  const topoTrilheiros = topoLinha2 - altCaminhao - gapLinha;
  desenharTrilheiros(p2, tril, M, topoTrilheiros, larguraTotal, altTrilheiros, true);

  return { capa, p, p2 };
}

const ALTURA_RODAPE = 40;

/** Texto do rodapé (período e data de emissão) e a linha que o separa do conteúdo. */
function desenharRodape(pg: PaginaPdf, d: DadosRelatorio, modo: 'semanal' | 'mensal' | 'diario', yBase: number) {
  const emitido = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  pg.linha(M, yBase + 30, L - M, yBase + 30, LINHA, 0.6);
  pg.texto(`Período: ${rotuloPeriodo(d.data, modo, d.desde).valor}  ·  Emitido em ${emitido}`, M, yBase + 18, 6.5, 'normal', CINZA);
  textoDireita(pg, 'Controle de Trilhos · Usina', L - M, yBase + 18, 6.5, 'negrito', CINZA);
}

/** Relatório em PDF (capa, dados e caminhão/trilheiros), como antes. */
export function gerarOnePageUsinaPdf(d: DadosRelatorio, tril: TrilheirosRelatorio, modo: 'semanal' | 'mensal' | 'diario' = 'semanal', colunasEscolhidas: Coluna[] = TODAS_COLUNAS, observacoes: string[] = []): Buffer {
  const { capa, p, p2 } = montarPaginasUsina(d, tril, modo, colunasEscolhidas, observacoes);
  desenharRodape(p, d, modo, 0);
  desenharRodape(p2, d, modo, 0);
  return montarPdfVarias([capa, p, p2], `Relatório gerencial usina ${d.data}`, A4_PAISAGEM);
}

/**
 * Relatório em imagem SVG, uma imagem por parte:
 * - 'capa': só a foto dos setores, sem margem;
 * - 'dados': cartões e setores (página 1 do relatório);
 * - 'caminhao': caminhão, trilheiros e observações (página 2).
 */
export function gerarOnePageUsinaSvg(
  d: DadosRelatorio,
  tril: TrilheirosRelatorio,
  modo: 'semanal' | 'mensal' | 'diario',
  colunasEscolhidas: Coluna[],
  observacoes: string[],
  pagina: 'capa' | 'dados' | 'caminhao' | 'tudo',
): string {
  if (pagina === 'tudo') {
    // Uma imagem só, sem espaço vazio: foto em cima, depois a página de dados e a do caminhão, cada uma até o último item.
    const larguraFoto = L;
    const alturaFoto = (larguraFoto * BANNER_RELATORIO.altura) / BANNER_RELATORIO.largura;
    const foto = new PaginaPdf();
    foto.imagem(bannerRelatorio, 0, 0, larguraFoto, alturaFoto);
    const { p, p2 } = montarPaginasUsina(d, tril, modo, colunasEscolhidas, observacoes);
    const altP = p.alturaUtil(H);
    const altP2 = p2.alturaUtil(H);
    // A segunda página começa logo depois da primeira, com o mesmo espaço (16pt) que separa os cartões do topo dos
    // cartões de setor. alturaUtil soma 14pt de folga embaixo, e o primeiro cartão da segunda página fica a 46pt do topo dela.
    const topoP2 = alturaFoto + (altP - 14) + 16 - 46;
    const total = topoP2 + altP2 + ALTURA_RODAPE;
    const rodape = new PaginaPdf().retangulo(0, 0, L, ALTURA_RODAPE, BRANCO);
    desenharRodape(rodape, d, modo, 0);
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1320" height="${Math.round((total * 1320) / L)}" viewBox="0 0 ${L} ${total.toFixed(2)}">` +
      foto.conteudoSvg(alturaFoto) +
      `<g transform="translate(0 ${alturaFoto.toFixed(2)})">${new PaginaPdf().retangulo(0, 0, L, total - alturaFoto, BRANCO).conteudoSvg(total - alturaFoto)}</g>` +
      `<g transform="translate(0 ${alturaFoto.toFixed(2)})">${p.conteudoSvg(H)}</g>` +
      `<g transform="translate(0 ${topoP2.toFixed(2)})">${p2.conteudoSvg(H)}</g>` +
      `<g transform="translate(0 ${(total - ALTURA_RODAPE).toFixed(2)})">${rodape.conteudoSvg(ALTURA_RODAPE)}</g>` +
      '</svg>'
    );
  }
  if (pagina === 'capa') {
    const foto = new PaginaPdf();
    foto.imagem(bannerRelatorio, 0, 0, BANNER_RELATORIO.largura, BANNER_RELATORIO.altura);
    return foto.svg(BANNER_RELATORIO.largura, BANNER_RELATORIO.altura);
  }
  const { p, p2 } = montarPaginasUsina(d, tril, modo, colunasEscolhidas, observacoes);
  return (pagina === 'dados' ? p : p2).svg(L, H);
}
