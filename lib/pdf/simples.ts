/**
 * Gerador mínimo de PDF (1 página A4, texto e retângulos), sem dependências.
 * Usa as fontes padrão do PDF (Helvetica), que já vêm em todo leitor — por isso o arquivo é
 * pequeno e abre igual no celular, no WhatsApp e no computador. Acentos do português funcionam
 * (codificação WinAnsi); caracteres fora dela viram "?".
 */

import zlib from 'node:zlib';

export const A4 = { largura: 595, altura: 842 } as const;

/** Desenho guardado em paralelo às operações do PDF, para gerar a mesma página em SVG. */
type Desenho =
  | { t: 'img'; img: ImagemPdf; x: number; y: number; l: number; a: number }
  | { t: 'ret'; x: number; y: number; l: number; a: number; r: number; cor: Cor; borda?: Cor }
  | { t: 'lin'; x1: number; y1: number; x2: number; y2: number; cor: Cor; esp: number }
  | { t: 'txt'; texto: string; x: number; y: number; tam: number; fonte: Fonte; cor: Cor; ancora: Ancora };

type Fonte = 'normal' | 'negrito';
type Cor = [number, number, number]; // 0–1
/** Onde fica o x do texto: no começo, no meio ou no fim (alinhado à direita). */
export type Ancora = 'inicio' | 'meio' | 'fim';

const NOME_FONTE: Record<Fonte, string> = { normal: 'F1', negrito: 'F2' };

// Larguras reais da Helvetica (métricas AFM, em milésimos de "em"), do espaço (32) ao til (126).
// Arial e Liberation Sans usam as mesmas larguras: o alinhamento bate no PDF e na imagem.
// prettier-ignore
const LARG_NORMAL = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
// prettier-ignore
const LARG_NEGRITO = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
// Caracteres fora do ASCII usados no relatório: [normal, negrito].
const LARG_ESPECIAL: Record<string, [number, number]> = {
  '—': [1000, 1000], '–': [556, 556], '·': [278, 278], '…': [1000, 1000], '“': [333, 500], '”': [333, 500],
  '‘': [222, 278], '’': [222, 278], '•': [350, 350], 'º': [365, 365], 'ª': [370, 370], '°': [400, 400], '×': [584, 584], '€': [556, 556],
};

function larguraCaractere(ch: string, fonte: Fonte): number {
  const especial = LARG_ESPECIAL[ch];
  if (especial) return especial[fonte === 'negrito' ? 1 : 0];
  let codigo = ch.codePointAt(0) ?? 63;
  // Letra acentuada (ã, ç, É...) tem a largura da letra sem acento.
  if (codigo > 126) codigo = ch.normalize('NFD').codePointAt(0) ?? 63;
  const tabela = fonte === 'negrito' ? LARG_NEGRITO : LARG_NORMAL;
  return codigo >= 32 && codigo <= 126 ? tabela[codigo - 32]! : 556;
}

// Caracteres comuns que o Latin-1 não tem, mas a codificação WinAnsi (cp1252) tem.
const CP1252: Record<string, string> = {
  '—': '\x97', '–': '\x96', '‘': '\x91', '’': '\x92', '“': '\x93', '”': '\x94', '•': '\x95', '€': '\x80',
};

function escaparTexto(texto: string): string {
  // Latin-1 cobre o português; o que não couber vira "?". Parênteses e barra precisam de escape.
  let saida = '';
  for (const ch of texto) {
    const codigo = ch.codePointAt(0) ?? 63;
    const c = codigo <= 255 ? ch : (CP1252[ch] ?? '?');
    if (c === '(' || c === ')' || c === '\\') saida += '\\' + c;
    else if (codigo < 32) saida += ' ';
    else if (c === ch && codigo >= 128 && codigo < 160) saida += '?';
    else saida += c;
  }
  return saida;
}

const num = (n: number) => Number(n.toFixed(2)).toString();
const cor = (c: Cor) => c.map(num).join(' ');

/** Imagem RGB de 8 bits, comprimida com zlib (FlateDecode). `nome` é a referência usada no conteúdo da página. */
export interface ImagemPdf { nome: string; largura: number; altura: number; dados: Buffer; filtro: 'FlateDecode' | 'DCTDecode' }
let contadorImagem = 0;
export function criarImagemPdf(largura: number, altura: number, dados: Buffer, filtro: 'FlateDecode' | 'DCTDecode' = 'FlateDecode'): ImagemPdf {
  contadorImagem += 1;
  return { nome: `Im${contadorImagem}`, largura, altura, dados, filtro };
}

export class PaginaPdf {
  private operacoes: string[] = [];
  private imagensUsadas: ImagemPdf[] = [];
  private desenhos: Desenho[] = [];

  /** Desenha uma imagem (x, y = canto inferior esquerdo) com a largura e altura dadas. */
  imagem(img: ImagemPdf, x: number, y: number, largura: number, altura: number): this {
    if (!this.imagensUsadas.includes(img)) this.imagensUsadas.push(img);
    this.operacoes.push(`q ${num(largura)} 0 0 ${num(altura)} ${num(x)} ${num(y)} cm /${img.nome} Do Q`);
    this.desenhos.push({ t: 'img', img, x, y, l: largura, a: altura });
    return this;
  }

  /** Imagens usadas nesta página (para montar os recursos do PDF). */
  get imagens(): ImagemPdf[] {
    return this.imagensUsadas;
  }

  retangulo(x: number, y: number, largura: number, altura: number, preenchimento: Cor): this {
    this.operacoes.push(`${cor(preenchimento)} rg ${num(x)} ${num(y)} ${num(largura)} ${num(altura)} re f`);
    this.desenhos.push({ t: 'ret', x, y, l: largura, a: altura, r: 0, cor: preenchimento });
    return this;
  }

  /**
   * Retângulo de cantos arredondados (x, y = canto inferior esquerdo). Com `borda`, desenha
   * contorno fino por cima do preenchimento.
   */
  arredondado(x: number, y: number, largura: number, altura: number, raio: number, preenchimento: Cor, borda?: Cor): this {
    const r = Math.min(raio, largura / 2, altura / 2);
    const k = 0.5523 * r;
    const f = num;
    const path = [
      `${f(x + r)} ${f(y)} m`,
      `${f(x + largura - r)} ${f(y)} l`,
      `${f(x + largura - r + k)} ${f(y)} ${f(x + largura)} ${f(y + r - k)} ${f(x + largura)} ${f(y + r)} c`,
      `${f(x + largura)} ${f(y + altura - r)} l`,
      `${f(x + largura)} ${f(y + altura - r + k)} ${f(x + largura - r + k)} ${f(y + altura)} ${f(x + largura - r)} ${f(y + altura)} c`,
      `${f(x + r)} ${f(y + altura)} l`,
      `${f(x + r - k)} ${f(y + altura)} ${f(x)} ${f(y + altura - r + k)} ${f(x)} ${f(y + altura - r)} c`,
      `${f(x)} ${f(y + r)} l`,
      `${f(x)} ${f(y + r - k)} ${f(x + r - k)} ${f(y)} ${f(x + r)} ${f(y)} c h`,
    ].join(' ');
    const borda2 = borda ? `${cor(borda)} RG 0.6 w ` : '';
    this.operacoes.push(`${cor(preenchimento)} rg ${borda2}${path} ${borda ? 'B' : 'f'}`);
    this.desenhos.push({ t: 'ret', x, y, l: largura, a: altura, r, cor: preenchimento, borda });
    return this;
  }

  linha(x1: number, y1: number, x2: number, y2: number, traco: Cor = [0.8, 0.82, 0.85], espessura = 0.7): this {
    this.operacoes.push(`${cor(traco)} RG ${num(espessura)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
    this.desenhos.push({ t: 'lin', x1, y1, x2, y2, cor: traco, esp: espessura });
    return this;
  }

  /**
   * (x, y) é a linha de base do texto; y cresce para cima, como no PDF. Com `ancora` 'meio' ou 'fim', x é o centro
   * ou a borda direita: no SVG quem alinha é o próprio navegador (text-anchor), então o texto fica no lugar certo
   * mesmo quando a fonte do aparelho tem larguras um pouco diferentes.
   */
  texto(texto: string, x: number, y: number, tamanho: number, fonte: Fonte = 'normal', cinza: Cor = [0.1, 0.12, 0.16], ancora: Ancora = 'inicio'): this {
    const largura = ancora === 'inicio' ? 0 : larguraTexto(texto, tamanho, fonte);
    const xPdf = ancora === 'fim' ? x - largura : ancora === 'meio' ? x - largura / 2 : x;
    this.operacoes.push(
      `BT ${cor(cinza)} rg /${NOME_FONTE[fonte]} ${num(tamanho)} Tf ${num(xPdf)} ${num(y)} Td (${escaparTexto(texto)}) Tj ET`,
    );
    this.desenhos.push({ t: 'txt', texto, x, y, tam: tamanho, fonte, cor: cinza, ancora });
    return this;
  }

  conteudo(): string {
    return this.operacoes.join('\n');
  }

  /** A mesma página em SVG (tamanho `largura` x `altura` em pontos; y do PDF vira y de cima para baixo). */
  svg(largura: number, altura: number): string {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${num(largura)}" height="${num(altura)}" viewBox="0 0 ${num(largura)} ${num(altura)}">` +
      this.conteudoSvg(altura) +
      '</svg>'
    );
  }

  /** Altura usada pelo conteúdo (do topo até o elemento mais baixo + folga), sem o fundo e a faixa de rodapé. */
  alturaUtil(altura: number): number {
    let minY = Infinity;
    for (const d of this.desenhos) {
      if (d.t === 'ret' && d.y <= 0 && d.a >= altura - 1) continue;
      const y = d.t === 'lin' ? Math.min(d.y1, d.y2) : d.y;
      if (y < 40) continue;
      minY = Math.min(minY, y);
    }
    return minY === Infinity ? altura : altura - minY + 14;
  }

  /** Só os elementos da página (sem a tag <svg>), para encaixar várias páginas numa imagem só. */
  conteudoSvg(altura: number): string {
    const yTopo = (y: number, a: number) => num(altura - y - a);
    const partes: string[] = [];
    for (const d of this.desenhos) {
      if (d.t === 'img') {
        partes.push(`<image x="${num(d.x)}" y="${yTopo(d.y, d.a)}" width="${num(d.l)}" height="${num(d.a)}" preserveAspectRatio="none" href="${uriDaImagem(d.img)}"/>`);
      } else if (d.t === 'ret') {
        const borda = d.borda ? ` stroke="${rgbCss(d.borda)}" stroke-width="0.6"` : '';
        partes.push(`<rect x="${num(d.x)}" y="${yTopo(d.y, d.a)}" width="${num(d.l)}" height="${num(d.a)}" rx="${num(d.r)}" fill="${rgbCss(d.cor)}"${borda}/>`);
      } else if (d.t === 'lin') {
        partes.push(`<line x1="${num(d.x1)}" y1="${num(altura - d.y1)}" x2="${num(d.x2)}" y2="${num(altura - d.y2)}" stroke="${rgbCss(d.cor)}" stroke-width="${num(d.esp)}"/>`);
      } else {
        const peso = d.fonte === 'negrito' ? ' font-weight="700"' : '';
        const ancora = d.ancora === 'meio' ? ' text-anchor="middle"' : d.ancora === 'fim' ? ' text-anchor="end"' : '';
        partes.push(
          `<text x="${num(d.x)}" y="${num(altura - d.y)}" font-family="Helvetica, Arial, 'Liberation Sans', Arimo, sans-serif" font-size="${num(d.tam)}"${peso}${ancora} fill="${rgbCss(d.cor)}">${escaparXml(d.texto)}</text>`,
        );
      }
    }
    return partes.join('');
  }
}

const rgbCss = (c: Cor) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

function escaparXml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const uriImagens = new WeakMap<ImagemPdf, string>();

/** Imagem como data URI: JPEG segue direto; RGB comprimido vira PNG. */
function uriDaImagem(img: ImagemPdf): string {
  const pronta = uriImagens.get(img);
  if (pronta) return pronta;
  let uri: string;
  if (img.filtro === 'DCTDecode') {
    uri = `data:image/jpeg;base64,${img.dados.toString('base64')}`;
  } else {
    uri = pngRgb(img.largura, img.altura, img.dados);
  }
  uriImagens.set(img, uri);
  return uri;
}

/** PNG de 8 bits RGB a partir do fluxo zlib (com ou sem bytes de filtro por linha). */
function pngRgb(largura: number, altura: number, dados: Buffer): string {
  const bruto = zlib.inflateSync(dados);
  const passo = largura * 3;
  let linhas: Buffer;
  if (bruto.length === altura * (passo + 1)) {
    linhas = bruto;
  } else {
    linhas = Buffer.alloc(altura * (passo + 1));
    for (let y = 0; y < altura; y++) bruto.copy(linhas, y * (passo + 1) + 1, y * passo, (y + 1) * passo);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // profundidade
  ihdr[9] = 2; // RGB
  const bloco = (tipo: string, corpo: Buffer) => {
    const tamanho = Buffer.alloc(4);
    tamanho.writeUInt32BE(corpo.length, 0);
    const tipoECorpo = Buffer.concat([Buffer.from(tipo, 'latin1'), corpo]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(tipoECorpo) >>> 0, 0);
    return Buffer.concat([tamanho, tipoECorpo, crc]);
  };
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco('IHDR', ihdr),
    bloco('IDAT', zlib.deflateSync(linhas)),
    bloco('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

/** Quebra o texto em linhas que cabem em `larguraMax` (pontos), por palavras. */
export function quebrarLinhas(texto: string, tamanho: number, larguraMax: number, fonte: Fonte = 'normal'): string[] {
  // Medida real de cada linha, com 2% de folga para a fonte do aparelho.
  const cabe = (t: string) => larguraTexto(t, tamanho, fonte) * 1.02 <= larguraMax;
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    // Palavra maior que a linha: corta no último caractere que cabe.
    let resto = palavra;
    while (!cabe(resto)) {
      if (atual) {
        linhas.push(atual);
        atual = '';
      }
      let n = Math.max(1, resto.length - 1);
      while (n > 1 && !cabe(resto.slice(0, n))) n--;
      linhas.push(resto.slice(0, n));
      resto = resto.slice(n);
    }
    const candidata = atual ? `${atual} ${resto}` : resto;
    if (!cabe(candidata)) {
      linhas.push(atual);
      atual = resto;
    } else atual = candidata;
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
}

export function montarPdf(pagina: PaginaPdf, titulo: string): Buffer {
  const fluxo = Buffer.from(pagina.conteudo(), 'latin1');
  const objetos: Buffer[] = [];
  const add = (s: string | Buffer) => objetos.push(Buffer.isBuffer(s) ? s : Buffer.from(s, 'latin1'));

  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  add(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.largura} ${A4.altura}] ` +
      '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
  );
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  add(Buffer.concat([Buffer.from(`<< /Length ${fluxo.length} >>\nstream\n`, 'latin1'), fluxo, Buffer.from('\nendstream', 'latin1')]));
  add(`<< /Title (${escaparTexto(titulo)}) /Producer (Controle de Trilhos) >>`);

  const partes: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const posicoes: number[] = [];
  let deslocamento = partes[0].length;
  objetos.forEach((obj, i) => {
    const bloco = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), obj, Buffer.from('\nendobj\n', 'latin1')]);
    posicoes.push(deslocamento);
    deslocamento += bloco.length;
    partes.push(bloco);
  });
  let xref = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of posicoes) xref += `${String(p).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${deslocamento}\n%%EOF\n`;
  partes.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(partes);
}

export const A4_PAISAGEM = { largura: 842, altura: 595 } as const;

/** Largura de um texto (pontos), pela métrica real da Helvetica. */
export function larguraTexto(texto: string, tamanho: number, fonte: Fonte = 'normal'): number {
  let total = 0;
  for (const ch of texto) total += larguraCaractere(ch, fonte);
  return (total * tamanho) / 1000;
}

/**
 * Várias páginas do mesmo tamanho. Objetos: 1 catálogo, 2 páginas, 3–4 fontes, 5 info,
 * e depois um par (página, conteúdo) por folha.
 */
export function montarPdfVarias(paginas: PaginaPdf[], titulo: string, tamanho: { largura: number; altura: number } = A4): Buffer {
  const objetos: Buffer[] = [];
  const add = (s: string | Buffer) => objetos.push(Buffer.isBuffer(s) ? s : Buffer.from(s, 'latin1'));
  const kids = paginas.map((_, i) => `${6 + 2 * i} 0 R`).join(' ');
  // Imagens do documento (sem repetir): ficam depois das páginas e dos conteúdos.
  const imagens: ImagemPdf[] = [];
  for (const pg of paginas) for (const im of pg.imagens) if (!imagens.includes(im)) imagens.push(im);
  const numeroImagem = (im: ImagemPdf) => 6 + 2 * paginas.length + imagens.indexOf(im);
  const recursoImagens = imagens.length ? ` /XObject << ${imagens.map((im) => `/${im.nome} ${numeroImagem(im)} 0 R`).join(' ')} >>` : '';

  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(`<< /Type /Pages /Kids [${kids}] /Count ${paginas.length} >>`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  add(`<< /Title (${escaparTexto(titulo)}) /Producer (Controle de Trilhos) >>`);
  paginas.forEach((pagina, i) => {
    const fluxo = Buffer.from(pagina.conteudo(), 'latin1');
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${tamanho.largura} ${tamanho.altura}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >>${recursoImagens} >> /Contents ${7 + 2 * i} 0 R >>`,
    );
    add(Buffer.concat([Buffer.from(`<< /Length ${fluxo.length} >>\nstream\n`, 'latin1'), fluxo, Buffer.from('\nendstream', 'latin1')]));
  });
  imagens.forEach((im) => {
    add(
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${im.largura} /Height ${im.altura} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${im.filtro} /Length ${im.dados.length} >>\nstream\n`,
          'latin1',
        ),
        im.dados,
        Buffer.from('\nendstream', 'latin1'),
      ]),
    );
  });

  const partes: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const posicoes: number[] = [];
  let deslocamento = partes[0].length;
  objetos.forEach((obj, i) => {
    const bloco = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), obj, Buffer.from('\nendobj\n', 'latin1')]);
    posicoes.push(deslocamento);
    deslocamento += bloco.length;
    partes.push(bloco);
  });
  let xref = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of posicoes) xref += `${String(p).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${deslocamento}\n%%EOF\n`;
  partes.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(partes);
}
