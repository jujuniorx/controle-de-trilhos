/**
 * Gerador mínimo de PDF (1 página A4, texto e retângulos), sem dependências.
 * Usa as fontes padrão do PDF (Helvetica), que já vêm em todo leitor — por isso o arquivo é
 * pequeno e abre igual no celular, no WhatsApp e no computador. Acentos do português funcionam
 * (codificação WinAnsi); caracteres fora dela viram "?".
 */

export const A4 = { largura: 595, altura: 842 } as const;

type Fonte = 'normal' | 'negrito';
type Cor = [number, number, number]; // 0–1

const NOME_FONTE: Record<Fonte, string> = { normal: 'F1', negrito: 'F2' };

// Largura média aproximada (em "em") da Helvetica — suficiente para quebrar linhas com folga.
const LARGURA_MEDIA: Record<Fonte, number> = { normal: 0.52, negrito: 0.57 };

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

export class PaginaPdf {
  private operacoes: string[] = [];

  retangulo(x: number, y: number, largura: number, altura: number, preenchimento: Cor): this {
    this.operacoes.push(`${cor(preenchimento)} rg ${num(x)} ${num(y)} ${num(largura)} ${num(altura)} re f`);
    return this;
  }

  linha(x1: number, y1: number, x2: number, y2: number, traco: Cor = [0.8, 0.82, 0.85], espessura = 0.7): this {
    this.operacoes.push(`${cor(traco)} RG ${num(espessura)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
    return this;
  }

  /** (x, y) é o canto inferior esquerdo da linha de texto; y cresce para cima, como no PDF. */
  texto(texto: string, x: number, y: number, tamanho: number, fonte: Fonte = 'normal', cinza: Cor = [0.1, 0.12, 0.16]): this {
    this.operacoes.push(
      `BT ${cor(cinza)} rg /${NOME_FONTE[fonte]} ${num(tamanho)} Tf ${num(x)} ${num(y)} Td (${escaparTexto(texto)}) Tj ET`,
    );
    return this;
  }

  conteudo(): string {
    return this.operacoes.join('\n');
  }
}

/** Quebra o texto em linhas que cabem em `larguraMax` (pontos), por palavras. */
export function quebrarLinhas(texto: string, tamanho: number, larguraMax: number, fonte: Fonte = 'normal'): string[] {
  const porLinha = Math.max(1, Math.floor(larguraMax / (tamanho * LARGURA_MEDIA[fonte])));
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    // palavra maior que a linha: corta
    let resto = palavra;
    while (resto.length > porLinha) {
      if (atual) {
        linhas.push(atual);
        atual = '';
      }
      linhas.push(resto.slice(0, porLinha));
      resto = resto.slice(porLinha);
    }
    const candidata = atual ? `${atual} ${resto}` : resto;
    if (candidata.length > porLinha) {
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

/** Largura aproximada de um texto (pontos), para alinhar à direita. */
export function larguraTexto(texto: string, tamanho: number, fonte: Fonte = 'normal'): number {
  return texto.length * tamanho * LARGURA_MEDIA[fonte];
}

/**
 * Várias páginas do mesmo tamanho. Objetos: 1 catálogo, 2 páginas, 3–4 fontes, 5 info,
 * e depois um par (página, conteúdo) por folha.
 */
export function montarPdfVarias(paginas: PaginaPdf[], titulo: string, tamanho: { largura: number; altura: number } = A4): Buffer {
  const objetos: Buffer[] = [];
  const add = (s: string | Buffer) => objetos.push(Buffer.isBuffer(s) ? s : Buffer.from(s, 'latin1'));
  const kids = paginas.map((_, i) => `${6 + 2 * i} 0 R`).join(' ');

  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(`<< /Type /Pages /Kids [${kids}] /Count ${paginas.length} >>`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  add(`<< /Title (${escaparTexto(titulo)}) /Producer (Controle de Trilhos) >>`);
  paginas.forEach((pagina, i) => {
    const fluxo = Buffer.from(pagina.conteudo(), 'latin1');
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${tamanho.largura} ${tamanho.altura}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${7 + 2 * i} 0 R >>`,
    );
    add(Buffer.concat([Buffer.from(`<< /Length ${fluxo.length} >>\nstream\n`, 'latin1'), fluxo, Buffer.from('\nendstream', 'latin1')]));
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
