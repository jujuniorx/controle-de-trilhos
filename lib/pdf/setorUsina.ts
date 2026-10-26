import { PaginaPdf, A4_PAISAGEM, montarPdfVarias, larguraTexto, quebrarLinhas } from '@/lib/pdf/simples';
import {
  AZUL,
  BRANCO,
  CINZA,
  H,
  L,
  LINHA,
  M,
  NAVY,
  SOMBRA,
  TINTA,
  ZEBRA,
  desenharSetor,
  hex,
  textoDireita,
} from '@/lib/pdf/onePageUsina';
import type { DadosRelatorio, TrilheirosRelatorio } from '@/lib/services/onePageUsina';
import { faixaSemanaSegSex } from '@/lib/usina/periodo';

/** Setores que têm PDF próprio (o "todos" é o relatório gerencial). */
export const SETORES_PDF = ['estaleiro', 'geracao', 'composicoes', 'caminhao', 'trilheiros'] as const;
export type SetorPdf = (typeof SETORES_PDF)[number];

const TITULO_SETOR: Record<SetorPdf, string> = {
  estaleiro: 'Estaleiro de solda',
  geracao: 'Geração de trilho',
  composicoes: 'Recolhimento serra',
  caminhao: 'Caminhão de solda',
  trilheiros: 'Trilheiros',
};

const TITULO_RELATORIO: Record<SetorPdf, string> = {
  estaleiro: 'Relatório do estaleiro de solda',
  geracao: 'Relatório da geração de trilho',
  composicoes: 'Relatório do recolhimento serra',
  caminhao: 'Relatório do caminhão de solda',
  trilheiros: 'Relatório dos trilheiros',
};

const COR_TRILHEIROS = hex('#0891b2');

/** Tabela dos trilheiros: uma linha por trilheiro, com B.O., partida, local, barras e observação. */
function desenharTrilheiros(p: PaginaPdf, t: TrilheirosRelatorio, x: number, topo: number, w: number, h: number) {
  const base = topo - h;
  p.arredondado(x + 1.2, base - 1.4, w, h, 9, SOMBRA);
  p.arredondado(x, base, w, h, 9, BRANCO, LINHA);
  p.arredondado(x, topo - 22, w, 22, 9, COR_TRILHEIROS);
  p.retangulo(x, topo - 22, w, 8, COR_TRILHEIROS);
  p.texto('TRILHEIROS', x + 10, topo - 14, 8, 'negrito', BRANCO);

  // Colunas (deslocamento a partir da borda esquerda do cartão)
  const col = { trilheiro: 10, bo: 96, diasBo: 180, partida: 278, diasPartida: 364, local: 462, barras: 540, obs: 628 };
  const yCabecalho = topo - 38;
  const rotulo = (texto: string, dx: number) => p.texto(texto, x + dx, yCabecalho, 6.5, 'negrito', CINZA);
  rotulo('TRILHEIRO', col.trilheiro);
  rotulo('B.O.', col.bo);
  rotulo('DIAS DESDE B.O.', col.diasBo);
  rotulo('PARTIDA', col.partida);
  rotulo('DIAS DESDE PARTIDA', col.diasPartida);
  rotulo('LOCAL', col.local);
  rotulo('BARRAS DESC. / TOTAL', col.barras);
  rotulo('OBSERVAÇÃO', col.obs);
  p.linha(x + 8, yCabecalho - 6, x + w - 8, yCabecalho - 6, LINHA, 0.6);

  const altLinha = 40;
  const primeiraBase = yCabecalho - 26;
  if (t.equipes.length === 0) {
    p.texto('Nenhum trilheiro com lançamento neste período.', x + col.trilheiro, primeiraBase, 9, 'normal', CINZA);
    return;
  }
  t.equipes.forEach((e, i) => {
    const y = primeiraBase - i * altLinha;
    if (i % 2 === 1) p.retangulo(x + 4, y - 14, w - 8, altLinha - 2, ZEBRA);
    p.texto(e.trilheiro, x + col.trilheiro, y, 10, 'negrito', TINTA);
    p.texto(brDaIso(e.bo), x + col.bo, y, 9, 'normal', TINTA);
    p.texto(e.giroDias == null ? '—' : String(e.giroDias), x + col.diasBo, y, 10, 'negrito', TINTA);
    p.texto(brDaIso(e.partida), x + col.partida, y, 9, 'normal', TINTA);
    p.texto(e.diasDesdePartida == null ? '—' : String(e.diasDesdePartida), x + col.diasPartida, y, 10, 'negrito', TINTA);
    if (e.local) {
      const largura = larguraTexto(e.local, 8, 'negrito') + 12;
      p.arredondado(x + col.local, y - 4, largura, 13, 6, NAVY);
      p.texto(e.local, x + col.local + 6, y, 8, 'negrito', BRANCO);
    } else {
      p.texto('—', x + col.local, y, 9, 'normal', CINZA);
    }
    p.texto(`${e.descarregadas} / ${e.total}`, x + col.barras, y, 10, 'negrito', COR_TRILHEIROS);
    const linhas = e.observacao ? quebrarLinhas(e.observacao, 7.5, w - col.obs - 16) : [];
    linhas.slice(0, 3).forEach((linha, k) => p.texto(linha, x + col.obs, y + 9 - k * 9, 7.5, 'normal', CINZA));
  });
}

function brDaIso(iso: string | null): string {
  return iso ? iso.split('-').reverse().join('/') : '—';
}

/** PDF de um setor da usina (uma folha A4 paisagem), no mesmo estilo do relatório gerencial. */
export function gerarSetorUsinaPdf(d: DadosRelatorio, tril: TrilheirosRelatorio, setor: SetorPdf): Buffer {
  const p = new PaginaPdf();
  p.retangulo(0, 0, L, H, BRANCO);
  p.retangulo(0, H - 5, L, 5, NAVY);
  p.retangulo(0, H - 5, L * 0.35, 5, AZUL);

  p.texto('CONTROLE DE TRILHOS', M, H - 26, 7.5, 'negrito', AZUL);
  p.texto(TITULO_RELATORIO[setor], M, H - 52, 21, 'negrito', TINTA);
  const semana = faixaSemanaSegSex(d.data);
  const wPilula = larguraTexto(semana, 10, 'negrito') + 26;
  p.arredondado(L - M - wPilula, H - 54, wPilula, 22, 11, hex('#e9f1fb'));
  textoDireita(p, semana, L - M - 13, H - 47, 10, 'negrito', NAVY);
  textoDireita(p, 'SEGUNDA A QUINTA', L - M, H - 26, 7, 'negrito', CINZA);
  p.linha(M, H - 62, L - M, H - 62, LINHA, 0.8);

  // Cartões de resumo deste setor (dia e semana)
  const cards = d.resumo.filter((r) => r.grupo === TITULO_SETOR[setor]);
  let topoCorpo = H - 80;
  if (cards.length > 0) {
    const gap = 10;
    const wRes = (L - 2 * M - (cards.length - 1) * gap) / cards.length;
    const topoCards = H - 70;
    const altRes = 56;
    cards.forEach((r, i) => {
      const x = M + i * (wRes + gap);
      p.arredondado(x + 1, topoCards - altRes - 1.2, wRes, altRes, 9, SOMBRA);
      p.arredondado(x, topoCards - altRes, wRes, altRes, 9, BRANCO, LINHA);
      p.arredondado(x + 8, topoCards - 15, 6, 6, 3, hex(r.cor));
      p.texto(r.rotulo.toUpperCase(), x + 18, topoCards - 14, 7, 'negrito', TINTA);
      const meio = x + wRes / 2 + 4;
      p.texto('Do dia', x + 8, topoCards - 30, 6.5, 'normal', CINZA);
      p.texto(r.dia, x + 8, topoCards - 46, 10, 'negrito', TINTA);
      p.texto('Da semana', meio, topoCards - 30, 6.5, 'normal', CINZA);
      p.texto(r.mes, meio, topoCards - 46, 10, 'negrito', hex(r.cor));
    });
    topoCorpo = topoCards - altRes - 16;
  }

  const alturaDisponivel = topoCorpo - 44;
  if (setor === 'trilheiros') {
    const altTril = Math.min(alturaDisponivel, 60 + Math.max(1, tril.equipes.length) * 40 + 12);
    desenharTrilheiros(p, tril, M, topoCorpo, L - 2 * M, altTril);
  } else {
    const s = d.setores.find((x) => x.titulo === TITULO_SETOR[setor]);
    if (s) desenharSetor(p, s, M, topoCorpo, L - 2 * M, Math.min(alturaDisponivel, 340), true, d.rotulosDias);
  }

  p.linha(M, 30, L - M, 30, LINHA, 0.6);
  p.texto(`Emitido em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, M, 18, 6.5, 'normal', CINZA);
  textoDireita(p, 'Controle de Trilhos · Usina', L - M, 18, 6.5, 'negrito', CINZA);

  return montarPdfVarias([p], `${TITULO_RELATORIO[setor]} ${d.data}`, A4_PAISAGEM);
}
