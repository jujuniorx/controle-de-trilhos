'use client';

// Baixa o relatório de produção do dia como imagem (PNG), desenhada aqui no navegador.
// A imagem é sempre clara, igual à folha impressa, qualquer que seja o tema da tela.
import { useState } from 'react';
import { IconeBaixar } from '@/components/icones/Icones';

export interface LinhaImagemProducao {
  hora: string;
  faixa: string;
  /** Hora com lançamento (sem lançamento, a linha sai com traços). */
  lancada: boolean;
  soldas: number;
  acumulado: number;
  perfil: string;
  fabricante: string;
  cortes: number;
  /** Cada parada: parte em negrito (horário) e o resto (tempo e motivo). */
  paradas: { forte: string; resto: string }[];
}

export interface DadosImagemProducao {
  arquivo: string;
  dataExtensa: string;
  soldador: string;
  perfil: string;
  fabricante: string;
  indicadores: { rotulo: string; valor: string; detalhe?: string }[];
  linhas: LinhaImagemProducao[];
  totalSoldas: number;
  totalCortes: number;
  totalParada: string;
  rodape: string;
  emitido: string;
}

const L = 1240; // largura da folha, em pontos da imagem
const M = 56; // margem
const TINTA = '#16191f';
const MEDIO = '#3c4350';
const SUAVE = '#5b6472';
const LINHA = '#d3d8e0';

type Ctx = CanvasRenderingContext2D;
type Trecho = { texto: string; forte: boolean };

function fontes() {
  const css = getComputedStyle(document.body);
  const base = css.getPropertyValue('--font-barlow').trim();
  const cond = css.getPropertyValue('--font-barlow-cond').trim();
  return {
    base: `${base ? `${base}, ` : ''}Arial, sans-serif`,
    cond: `${cond ? `${cond}, ` : ''}${base ? `${base}, ` : ''}Arial, sans-serif`,
  };
}

function espacar(ctx: Ctx, valor: string) {
  // Espaço entre letras dos rótulos; navegador antigo ignora e o texto sai normal.
  (ctx as Ctx & { letterSpacing?: string }).letterSpacing = valor;
}

function caixa(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Quebra os trechos (negrito e normal misturados) em linhas que cabem na largura. */
function quebrar(ctx: Ctx, trechos: Trecho[], largura: number, fonte: (forte: boolean) => string): Trecho[][] {
  const linhas: Trecho[][] = [[]];
  let usado = 0;
  for (const t of trechos) {
    ctx.font = fonte(t.forte);
    for (const palavra of t.texto.split(/(\s+)/).filter(Boolean)) {
      const w = ctx.measureText(palavra).width;
      const espaco = /^\s+$/.test(palavra);
      if (usado + w > largura && usado > 0 && !espaco) {
        linhas.push([]);
        usado = 0;
      }
      if (espaco && usado === 0) continue;
      linhas[linhas.length - 1].push({ texto: palavra, forte: t.forte });
      usado += w;
    }
  }
  return linhas;
}

/** Desenha a folha inteira e devolve a altura usada. Roda duas vezes: uma para medir, outra para valer. */
function desenhar(ctx: Ctx, d: DadosImagemProducao, logo: HTMLImageElement | null): number {
  const f = fontes();
  const rotulo = (tam: number) => `700 ${tam}px ${f.base}`;
  ctx.textBaseline = 'alphabetic';
  let y = M;

  // ---- Cabeçalho ----
  ctx.fillStyle = SUAVE;
  ctx.font = rotulo(13);
  espacar(ctx, '1.8px');
  const marca = 'CONTROLE DE TRILHOS';
  ctx.textAlign = 'left';
  ctx.fillText(marca, M, y + 14);
  let x = M + ctx.measureText(marca).width + 8;
  ctx.fillText('-', x, y + 14);
  x += ctx.measureText('-').width + 8;
  espacar(ctx, '0px');
  if (logo) {
    const alt = 20;
    ctx.drawImage(logo, x, y, (alt * logo.naturalWidth) / logo.naturalHeight, alt);
  } else {
    ctx.font = `700 15px ${f.base}`;
    ctx.fillText('RUMO', x, y + 14);
  }
  ctx.fillStyle = TINTA;
  ctx.font = `700 46px ${f.cond}`;
  ctx.fillText('RELATÓRIO DE PRODUÇÃO', M, y + 66);
  ctx.fillStyle = MEDIO;
  ctx.font = `400 18px ${f.base}`;
  ctx.fillText(`Estaleiro de soldas - Bauru · ${d.dataExtensa}`, M, y + 96);

  // Ficha à direita: soldador, trilho e fabricante.
  const ficha: [string, string, number, number][] = [
    ['SOLDADOR', d.soldador, L - M - 330, y + 12],
    ['TRILHO DO DIA', d.perfil, L - M - 130, y + 12],
    ['FABRICANTE', d.fabricante, L - M - 330, y + 64],
  ];
  for (const [nome, valor, fx, fy] of ficha) {
    ctx.fillStyle = SUAVE;
    ctx.font = rotulo(11);
    espacar(ctx, '1.1px');
    ctx.fillText(nome, fx, fy);
    espacar(ctx, '0px');
    ctx.fillStyle = TINTA;
    ctx.font = `600 18px ${f.base}`;
    ctx.fillText(valor, fx, fy + 22);
  }
  y += 114;
  ctx.fillStyle = TINTA;
  ctx.fillRect(M, y, L - 2 * M, 2);
  y += 22;

  // ---- Indicadores ----
  const vao = 14;
  const larg = (L - 2 * M - vao * 3) / 4;
  d.indicadores.slice(0, 4).forEach((ind, i) => {
    const ix = M + i * (larg + vao);
    caixa(ctx, ix, y, larg, 112, 12);
    if (i === 0) {
      ctx.fillStyle = TINTA;
      ctx.fill();
    } else {
      ctx.strokeStyle = LINHA;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.fillStyle = i === 0 ? '#ffffff' : SUAVE;
    ctx.font = rotulo(11);
    espacar(ctx, '1.1px');
    ctx.fillText(ind.rotulo.toUpperCase(), ix + 18, y + 28);
    espacar(ctx, '0px');
    ctx.fillStyle = i === 0 ? '#ffffff' : TINTA;
    ctx.font = `700 44px ${f.cond}`;
    ctx.fillText(ind.valor, ix + 18, y + 72);
    if (ind.detalhe) {
      ctx.fillStyle = i === 0 ? '#ffffff' : SUAVE;
      ctx.font = `400 13px ${f.base}`;
      ctx.fillText(ind.detalhe, ix + 18, y + 96);
    }
  });
  y += 112 + 20;

  // ---- Ritmo por hora ----
  const passo = 27;
  const altRitmo = 52 + d.linhas.length * passo + 8;
  caixa(ctx, M, y, L - 2 * M, altRitmo, 12);
  ctx.strokeStyle = LINHA;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = SUAVE;
  ctx.font = rotulo(12);
  espacar(ctx, '1.4px');
  ctx.fillText('RITMO POR HORA', M + 22, y + 32);
  espacar(ctx, '0px');
  const maior = Math.max(1, ...d.linhas.map((l) => l.soldas));
  const bx = M + 22 + 150;
  const bw = L - M - 22 - 60 - bx;
  d.linhas.forEach((l, i) => {
    const ly = y + 52 + i * passo;
    ctx.fillStyle = MEDIO;
    ctx.font = `400 15px ${f.base}`;
    ctx.textAlign = 'left';
    ctx.fillText(l.faixa, M + 22, ly + 14);
    caixa(ctx, bx, ly + 3, bw, 12, 6);
    ctx.fillStyle = '#e8ebf0';
    ctx.fill();
    if (l.soldas > 0) {
      caixa(ctx, bx, ly + 3, Math.max((l.soldas / maior) * bw, 12), 12, 6);
      ctx.fillStyle = TINTA;
      ctx.fill();
    }
    ctx.fillStyle = TINTA;
    ctx.font = `700 15px ${f.base}`;
    ctx.textAlign = 'right';
    ctx.fillText(l.soldas > 0 ? String(l.soldas) : '—', L - M - 22, ly + 14);
  });
  ctx.textAlign = 'left';
  y += altRitmo + 20;

  // ---- Detalhe por hora ----
  const tx = M + 22;
  const tw = L - 2 * M - 44;
  // Colunas: hora, soldas, acumulado, trilho, fabricante, cortes, paradas.
  const col = { hora: tx + 10, soldas: tx + 150, acum: tx + 230, trilho: tx + 262, fab: tx + 350, cortes: tx + 560, paradas: tx + 590 };
  const largParadas = tx + tw - 10 - col.paradas;
  const fonteParada = (forte: boolean) => `${forte ? 700 : 400} 15px ${f.base}`;
  const altLinha = 21;
  const linhas = d.linhas.map((l) => {
    const blocos = l.paradas.map((p) => quebrar(ctx, [{ texto: p.forte, forte: true }, { texto: p.resto, forte: false }], largParadas, fonteParada));
    const qtd = Math.max(1, blocos.reduce((s, b) => s + b.length, 0));
    return { l, blocos, altura: qtd * altLinha + 16 };
  });
  const altTabela = 50 + 34 + linhas.reduce((s, r) => s + r.altura, 0) + 46 + 14;
  caixa(ctx, M, y, L - 2 * M, altTabela, 12);
  ctx.strokeStyle = LINHA;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = SUAVE;
  ctx.font = rotulo(12);
  espacar(ctx, '1.4px');
  ctx.fillText('DETALHE POR HORA', tx, y + 32);
  let ty = y + 50;
  // Títulos das colunas
  ctx.fillStyle = '#f0f2f5';
  ctx.fillRect(tx, ty, tw, 34);
  ctx.fillStyle = MEDIO;
  ctx.font = rotulo(11);
  espacar(ctx, '.9px');
  ctx.fillText('HORA', col.hora, ty + 22);
  ctx.fillText('TRILHO', col.trilho, ty + 22);
  ctx.fillText('FABRICANTE', col.fab, ty + 22);
  ctx.fillText('PARADAS (HORÁRIO, TEMPO E MOTIVO)', col.paradas, ty + 22);
  ctx.textAlign = 'right';
  ctx.fillText('SOLDAS', col.soldas, ty + 22);
  ctx.fillText('ACUM.', col.acum, ty + 22);
  ctx.fillText('CORTES', col.cortes, ty + 22);
  espacar(ctx, '0px');
  ty += 34;
  linhas.forEach(({ l, blocos, altura }, i) => {
    if (i % 2 === 1) {
      ctx.fillStyle = '#f7f8fa';
      ctx.fillRect(tx, ty, tw, altura);
    }
    ctx.fillStyle = '#e1e5eb';
    ctx.fillRect(tx, ty + altura - 1, tw, 1);
    const base = ty + 8 + 15;
    ctx.fillStyle = TINTA;
    ctx.textAlign = 'left';
    ctx.font = `400 15px ${f.base}`;
    ctx.fillText(l.hora, col.hora, base);
    ctx.fillText(l.lancada ? l.perfil : '—', col.trilho, base);
    ctx.fillText(l.lancada ? l.fabricante : '—', col.fab, base);
    ctx.textAlign = 'right';
    ctx.fillText(l.lancada ? String(l.acumulado) : '—', col.acum, base);
    ctx.fillText(l.cortes > 0 ? String(l.cortes) : '—', col.cortes, base);
    ctx.font = `700 15px ${f.base}`;
    ctx.fillText(l.soldas > 0 ? String(l.soldas) : '—', col.soldas, base);
    ctx.textAlign = 'left';
    if (blocos.length === 0) {
      ctx.font = fonteParada(false);
      ctx.fillText('—', col.paradas, base);
    } else {
      let py = base;
      for (const bloco of blocos) {
        for (const linha of bloco) {
          let px = col.paradas;
          for (const t of linha) {
            ctx.font = fonteParada(t.forte);
            ctx.fillStyle = t.forte ? TINTA : MEDIO;
            ctx.fillText(t.texto, px, py);
            px += ctx.measureText(t.texto).width;
          }
          py += altLinha;
        }
      }
    }
    ty += altura;
  });
  // Total
  ctx.fillStyle = TINTA;
  ctx.fillRect(tx, ty, tw, 1.5);
  ctx.font = `700 15px ${f.base}`;
  ctx.textAlign = 'left';
  ctx.fillText('Total', col.hora, ty + 29);
  ctx.fillText(d.totalParada, col.paradas, ty + 29);
  ctx.textAlign = 'right';
  ctx.fillText(String(d.totalSoldas), col.soldas, ty + 29);
  ctx.fillText(d.totalCortes > 0 ? String(d.totalCortes) : '—', col.cortes, ty + 29);
  ctx.textAlign = 'left';
  y += altTabela + 22;

  // ---- Rodapé ----
  ctx.fillStyle = LINHA;
  ctx.fillRect(M, y, L - 2 * M, 1);
  ctx.fillStyle = SUAVE;
  ctx.font = `400 13px ${f.base}`;
  ctx.fillText(d.rodape, M, y + 24);
  ctx.textAlign = 'right';
  ctx.fillText(`Emitido em ${d.emitido}`, L - M, y + 24);
  ctx.textAlign = 'left';
  return y + 24 + M - 16;
}

function carregarLogo(): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null); // sem a logo, sai o nome escrito
    img.src = '/logo-rumo-relatorio.png';
  });
}

async function gerarPng(dados: DadosImagemProducao): Promise<Blob> {
  const f = fontes();
  // Garante as letras do sistema carregadas antes de desenhar (senão a imagem sai em Arial).
  await Promise.all([`400 15px ${f.base}`, `700 15px ${f.base}`, `600 18px ${f.base}`, `700 46px ${f.cond}`].map((fonte) => document.fonts?.load(fonte).catch(() => [])));
  const logo = await carregarLogo();
  const medida = document.createElement('canvas').getContext('2d');
  if (!medida) throw new Error('desenho indisponível neste navegador');
  const altura = Math.ceil(desenhar(medida, dados, null));
  const escala = 2; // texto nítido no celular e no WhatsApp
  const canvas = document.createElement('canvas');
  canvas.width = L * escala;
  canvas.height = altura * escala;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('desenho indisponível neste navegador');
  ctx.scale(escala, escala);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, L, altura);
  desenhar(ctx, dados, logo);
  const png = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
  if (!png) throw new Error('não gerou o PNG');
  return png;
}

export function BotaoBaixarImagem({ dados }: { dados: DadosImagemProducao }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar() {
    setErro(null);
    setOcupado(true);
    try {
      const png = await gerarPng(dados);
      const arquivo = new File([png], dados.arquivo, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      // Celular e tablet: abre o menu do aparelho (salvar imagem, WhatsApp…). Computador: baixa o arquivo.
      const ehToque = window.matchMedia?.('(pointer: coarse)').matches ?? false;
      if (ehToque && nav.share && nav.canShare?.({ files: [arquivo] })) {
        await nav.share({ files: [arquivo], title: 'Relatório de produção' });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(png);
        link.download = dados.arquivo;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      }
    } catch (e) {
      // Fechar o menu de compartilhar não é erro.
      if (!(e instanceof DOMException && e.name === 'AbortError')) setErro(`Não foi possível gerar a imagem (${e instanceof Error ? e.message : 'erro'}). Tente de novo.`);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <button type="button" onClick={baixar} disabled={ocupado} className="btn btn-secondary btn-sm no-print">
        <IconeBaixar size={14} /> {ocupado ? 'Gerando…' : 'Baixar imagem'}
      </button>
      {erro && <span role="alert" className="no-print text-sm text-bad">{erro}</span>}
    </>
  );
}
