import { PaginaPdf, A4_PAISAGEM, montarPdfVarias, larguraTexto } from '@/lib/pdf/simples';
import { desenharTrilheiros } from '@/lib/pdf/tabelaTrilheiros';
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
    const altRes = 64;
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
      p.texto(r.semana, meio, topoCards - 46, 10, 'negrito', hex(r.cor));
      p.texto('No mês', x + 8, topoCards - 55, 6.5, 'normal', CINZA);
      p.texto(r.mes, x + 42, topoCards - 55, 8, 'negrito', hex(r.cor));
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
