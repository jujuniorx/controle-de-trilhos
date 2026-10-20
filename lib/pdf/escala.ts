import { PaginaPdf, A4_PAISAGEM, montarPdfVarias, larguraTexto } from '@/lib/pdf/simples';
import { ESTILO_STATUS, ITENS_ESCALA, ITENS_SEM_LOCAL, GRUPOS_ESCALA, STATUS_ESCALA, TIPOS_CICLO, diasDaSemana, type EscalaSemanaValor } from '@/lib/usina/escala';

type Cor = [number, number, number];

const hex = (h: string): Cor => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const BRANCO: Cor = [1, 1, 1];
const PAPEL: Cor = [0.975, 0.98, 0.985];
const NAVY: Cor = [0.07, 0.1, 0.15];
const NAVY_2: Cor = [0.13, 0.17, 0.24];
const TINTA: Cor = [0.1, 0.12, 0.16];
const CINZA: Cor = [0.42, 0.45, 0.5];
const LINHA: Cor = [0.84, 0.86, 0.9];
const AZUL: Cor = [0.16, 0.42, 0.95];
const FIM_SEMANA: Cor = [0.945, 0.952, 0.965];
const TINTA_SUAVE: Cor = [0.28, 0.32, 0.38];

const L = A4_PAISAGEM.largura; // 842
const H = A4_PAISAGEM.altura; // 595
const M = 36;

const dataBr = (iso: string) => iso.split('-').reverse().join('/');

/** Corta o texto para caber na largura, com reticencias. */
function caber(texto: string, tamanho: number, largura: number, fonte: 'normal' | 'negrito' = 'normal'): string {
  if (larguraTexto(texto, tamanho, fonte) <= largura) return texto;
  let t = texto;
  while (t.length > 1 && larguraTexto(t + '...', tamanho, fonte) > largura) t = t.slice(0, -1);
  return t + '...';
}

function centralizado(p: PaginaPdf, texto: string, x: number, w: number, y: number, tamanho: number, fonte: 'normal' | 'negrito', c: Cor) {
  const t = caber(texto, tamanho, w - 6, fonte);
  p.texto(t, x + (w - larguraTexto(t, tamanho, fonte)) / 2, y, tamanho, fonte, c);
}

/** Contorno de uma celula (para destacar o MMD). */
function contorno(p: PaginaPdf, x: number, y: number, w: number, h: number, c: Cor, espessura: number) {
  p.linha(x, y, x + w, y, c, espessura);
  p.linha(x, y + h, x + w, y + h, c, espessura);
  p.linha(x, y, x, y + h, c, espessura);
  p.linha(x + w, y, x + w, y + h, c, espessura);
}

/** Gera o PDF da escala da semana (A4 paisagem): cabecalho, legenda, grade e rodape. */
export function gerarEscalaPdf(semana: string, valor: EscalaSemanaValor, emitidoEm: string): Buffer {
  const p = new PaginaPdf();
  p.retangulo(0, 0, L, H, BRANCO);

  // Cabecalho em faixa escura
  p.retangulo(0, H - 92, L, 92, NAVY);
  p.texto('Escala da semana', M, H - 60, 22, 'negrito', BRANCO);
  const dias = diasDaSemana(semana);
  const periodo = `${dias[0].data} a ${dias[6].data}/${semana.slice(0, 4)}`;
  const xPeriodo = L - M - larguraTexto(periodo, 13, 'negrito');
  p.texto('PERÍODO', xPeriodo - 0, H - 30, 7, 'negrito', [0.6, 0.66, 0.76]);
  p.texto(periodo, L - M - larguraTexto(periodo, 13, 'negrito'), H - 52, 13, 'negrito', BRANCO);

  // Legenda
  const legenda = STATUS_ESCALA.filter((s) => s.valor !== '-');
  let xl = M;
  const yl = H - 112;
  p.texto('LEGENDA', xl, yl + 2, 6.5, 'negrito', CINZA);
  xl += 52;
  for (const s of legenda) {
    const est = ESTILO_STATUS[s.valor];
    const w = larguraTexto(s.rotulo, 7.5, 'negrito') + 14;
    p.retangulo(xl, yl - 2, w, 14, hex(est.fundo));
    p.texto(s.rotulo, xl + 7, yl + 2, 7.5, 'negrito', hex(est.texto));
    xl += w + 6;
  }
  p.texto('MMD = empresa de manutenção (destacada)', xl + 8, yl + 2, 7, 'normal', CINZA);

  // Grade
  const xQuem = M;
  const wQuem = 124;
  const wDia = (L - 2 * M - wQuem) / 7;
  const xDia = (i: number) => xQuem + wQuem + i * wDia;
  let y = H - 128;

  // Cabecalho dos dias
  p.retangulo(xQuem, y - 30, L - 2 * M, 30, NAVY_2);
  p.texto('QUEM', xQuem + 8, y - 19, 7.5, 'negrito', BRANCO);
  dias.forEach((d, i) => {
    centralizado(p, d.nome.toUpperCase(), xDia(i), wDia, y - 14, 9, 'negrito', BRANCO);
    centralizado(p, d.data, xDia(i), wDia, y - 26, 7, 'normal', [0.75, 0.8, 0.88]);
  });
  y -= 30;

  // Plantao: so sabado e domingo
  p.retangulo(xQuem, y - 24, L - 2 * M, 24, [0.93, 0.95, 0.98]);
  p.texto('PLANTÃO', xQuem + 8, y - 15, 7.5, 'negrito', NAVY);
  dias.forEach((_, i) => {
    const nome = valor.plantao[i] ?? '';
    if (i < 5) {
      centralizado(p, '-', xDia(i), wDia, y - 15, 8, 'normal', CINZA);
    } else {
      centralizado(p, nome || '-', xDia(i), wDia, y - 15, 8.5, 'negrito', TINTA);
    }
  });
  y -= 24;

  for (const grupo of GRUPOS_ESCALA) {
    y -= 4;
    p.texto(grupo.toUpperCase(), xQuem, y - 9, 7, 'negrito', AZUL);
    p.linha(xQuem + larguraTexto(grupo.toUpperCase(), 7, 'negrito') + 8, y - 6, L - M, y - 6, LINHA, 0.6);
    y -= 12;

    for (const item of ITENS_ESCALA.filter((it) => it.grupo === grupo)) {
      const cfg = valor.config[item.id];
      const semLocal = ITENS_SEM_LOCAL.has(item.id);
      const tipoRotulo = cfg?.tipo === 'e18' ? '10x4' : TIPOS_CICLO.find((t) => t.valor === cfg?.tipo)?.rotulo ?? '';
      const altura = semLocal ? 19 : 19 + 12;
      const nome = item.rotulo.replace(' · ', ' ');
      // Nome do item e tipo de escala
      p.retangulo(xQuem, y - altura, wQuem - 4, altura, PAPEL);
      p.retangulo(xQuem, y - altura, 3, altura, NAVY_2);
      p.texto(nome, xQuem + 10, y - (semLocal ? 13 : 13), semLocal ? 9.5 : 11, semLocal ? 'normal' : 'negrito', semLocal ? CINZA : TINTA);
      if (tipoRotulo && tipoRotulo !== 'Manual' && !semLocal) p.texto(tipoRotulo, xQuem + 10, y - altura + 3, 7, 'normal', CINZA);

      const linhas = valor.linhas[item.id] ?? [];
      linhas.forEach((c, i) => {
        const est = ESTILO_STATUS[c.status] ?? ESTILO_STATUS['-'];
        const fimDeSemana = i >= 5;
        const x = xDia(i) + 1.5;
        const w = wDia - 3;
        // Status
        if (c.status !== '-') p.retangulo(x, y - 18, w, 17, hex(est.fundo));
        else p.retangulo(x, y - 18, w, 17, fimDeSemana ? FIM_SEMANA : PAPEL);
        const rotulo = STATUS_ESCALA.find((st) => st.valor === c.status)?.rotulo ?? '·';
        centralizado(p, c.status === '-' ? '-' : rotulo, x, w, y - 13, 9, 'negrito', hex(est.texto));
        if (semLocal) return;
        // Local
        p.retangulo(x, y - altura, w, 11, fimDeSemana ? FIM_SEMANA : BRANCO);
        if (c.local) centralizado(p, c.local, x, w, y - altura + 2.5, 7.5, 'normal', TINTA_SUAVE);
        // MMD destacada
        if (c.local.trim().toUpperCase() === 'MMD') contorno(p, x, y - altura, w, altura, AZUL, 1.6);
      });
      y -= altura + 2;
    }
  }

  // Rodape
  p.linha(M, 30, L - M, 30, LINHA, 0.6);
  p.texto('Controle de Trilhos · Escala da semana', M, 18, 7, 'normal', CINZA);
  const emitido = `Emitido em ${emitidoEm}`;
  p.texto(emitido, L - M - larguraTexto(emitido, 7), 18, 7, 'normal', CINZA);

  return montarPdfVarias([p], `Escala da semana ${dataBr(semana)}`, A4_PAISAGEM);
}
