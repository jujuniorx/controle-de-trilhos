import { PaginaPdf, A4_PAISAGEM, montarPdfVarias } from '@/lib/pdf/simples';
import { niceEixo, type SerieGrafico, type Unidade } from '@/lib/services/informativoGrafico';

type Cor = [number, number, number];
export type TemaPdf = 'claro' | 'escuro';

interface Paleta { fundo: Cor; tinta: Cor; muda: Cor; grade: Cor; eixo: Cor }
const PALETAS: Record<TemaPdf, Paleta> = {
  claro: { fundo: [1, 1, 1], tinta: [0.07, 0.09, 0.13], muda: [0.42, 0.45, 0.5], grade: [0.9, 0.91, 0.93], eixo: [0.3, 0.33, 0.38] },
  escuro: { fundo: [0.07, 0.08, 0.1], tinta: [0.91, 0.93, 0.95], muda: [0.61, 0.67, 0.72], grade: [0.18, 0.23, 0.28], eixo: [0.5, 0.56, 0.62] },
};

export interface CartaoPdf { rotulo: string; valor: string; detalhe?: string; cor: string }

export interface DadosInformativoPdf {
  ano: number;
  unidade: Unidade;
  series: SerieGrafico[];
  meses: string[];
  cartoes: CartaoPdf[];
  filtro: string;
  tema: TemaPdf;
  emitidoEm: Date;
}

const MARGEM = 40;

function hexParaCor(hex: string): Cor {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const num = (v: number) => Math.round(v).toLocaleString('pt-BR');

/** Gráfico mensal (barras) e cartões da lateral, no tema escolhido. */
export function gerarInformativoPdf(d: DadosInformativoPdf): Buffer {
  const L = A4_PAISAGEM.largura;
  const H = A4_PAISAGEM.altura;
  const pal = PALETAS[d.tema];
  const p = new PaginaPdf();

  p.retangulo(0, 0, L, H, pal.fundo);
  p.texto(`Trilhos ${d.ano}`, MARGEM, H - 52, 24, 'negrito', pal.tinta);
  p.texto(`Recolhido por mês, em ${d.unidade === 'barras' ? 'barras' : 'metros'}  ·  ${d.filtro}`, MARGEM, H - 70, 10, 'normal', pal.muda);

  // Legenda
  let lx = MARGEM;
  for (const s of d.series) {
    p.retangulo(lx, H - 100, 10, 10, hexParaCor(s.cor));
    p.texto(s.rotulo, lx + 15, H - 99, 9, 'normal', pal.tinta);
    lx += 15 + s.rotulo.length * 5 + 22;
  }

  // Eixo e grade
  const x0 = 86;
  const yBase = 100;
  const ph = H - 100 - 30 - yBase;
  const plotW = 500;
  const topo = Math.max(1, ...d.series.flatMap((s) => s.valores));
  const { max, passo } = niceEixo(topo);
  const y = (v: number) => yBase + (v / max) * ph;
  for (let v = 0; v <= max; v += passo) {
    p.linha(x0, y(v), x0 + plotW, y(v), v === 0 ? pal.eixo : pal.grade, v === 0 ? 0.9 : 0.5);
    p.texto(num(v), x0 - 8 - num(v).length * 4.5, y(v) - 3, 8, 'normal', pal.muda);
  }
  p.texto(d.unidade === 'barras' ? 'barras' : 'metros', MARGEM, yBase + ph + 14, 8, 'normal', pal.muda);

  // Barras
  const gw = plotW / Math.max(d.meses.length, 1);
  const n = d.series.length;
  const bw = Math.min(22, (gw * 0.7) / n);
  d.meses.forEach((mes, i) => {
    const inicio = x0 + i * gw + (gw - bw * n) / 2;
    d.series.forEach((s, j) => {
      const v = s.valores[i] ?? 0;
      if (v <= 0) return;
      const bx = inicio + j * bw;
      const altura = y(v) - yBase;
      p.retangulo(bx, yBase, bw - 2, altura, hexParaCor(s.cor));
      p.texto(num(v), bx + (bw - 2) / 2 - num(v).length * 2.6, y(v) + 4, 7.5, 'normal', pal.tinta);
    });
    p.texto(mes, x0 + i * gw + gw / 2 - mes.length * 3, yBase - 14, 9, 'normal', pal.tinta);
  });

  // Cartões da lateral (sempre em metros)
  const cx = 610;
  let cy = H - 120;
  for (const c of d.cartoes) {
    p.texto(c.rotulo.toUpperCase(), cx, cy, 8, 'negrito', pal.muda);
    p.texto(c.valor, cx, cy - 22, 15, 'negrito', hexParaCor(c.cor));
    if (c.detalhe) p.texto(c.detalhe, cx, cy - 36, 9, 'normal', pal.muda);
    cy -= 80;
  }

  p.texto('W61 e W62: barras × 10,5 m. Pendente = meta - recolhido.', MARGEM, 36, 8, 'normal', pal.muda);
  const emitido = `Emitido em ${d.emitidoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}`;
  p.texto(emitido, L - MARGEM - emitido.length * 4.2, 36, 8, 'normal', pal.muda);

  return montarPdfVarias([p], `Trilhos ${d.ano}`, A4_PAISAGEM);
}
