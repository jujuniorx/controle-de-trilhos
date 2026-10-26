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
  ZEBRA,
  desenharSetor,
  hex,
  textoDireita,
} from '@/lib/pdf/onePageUsina';
import type { DadosRelatorio, LinhaRelatorio, TrilheirosRelatorio } from '@/lib/services/onePageUsina';
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

const SETOR_DA_OBSERVACAO: Partial<Record<SetorPdf, string>> = {
  estaleiro: 'estaleiro',
  geracao: 'geracao',
  composicoes: 'serra',
  caminhao: 'caminhao',
};

const NOME_DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

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
/** Grade diária: uma linha por campo, uma coluna por dia (segunda a domingo) e as colunas de semana e mês. */
function desenharGradeDiaria(p: PaginaPdf, linhas: LinhaRelatorio[], cor: string, rotulosDias: string[], x: number, topo: number, w: number) {
  const colLabel = 200;
  const colSemMes = 80;
  const colDia = (w - colLabel - 2 * colSemMes) / Math.max(1, rotulosDias.length);
  const xDia = (i: number) => x + colLabel + i * colDia;
  const xSem = x + colLabel + rotulosDias.length * colDia + colSemMes;
  const xMes = x + w - 8;
  const yCab = topo - 14;
  p.arredondado(x, topo - 22, w, 22, 9, hex(cor));
  p.retangulo(x, topo - 22, w, 8, hex(cor));
  rotulosDias.forEach((r, i) => textoDireita(p, r.toUpperCase(), xDia(i + 1) - 6, yCab, 6.5, 'negrito', BRANCO));
  textoDireita(p, 'SEMANA', xSem, yCab, 6.5, 'negrito', BRANCO);
  textoDireita(p, 'NO MÊS', xMes, yCab, 6.5, 'negrito', BRANCO);
  p.texto('CAMPO', x + 10, yCab, 6.5, 'negrito', BRANCO);
  let y = topo - 36;
  linhas.forEach((linha, i) => {
    y -= 20;
    if (i % 2 === 1) p.retangulo(x + 4, y - 6, w - 8, 20, ZEBRA);
    p.texto(linha.rotulo, x + 10, y, 8, 'normal', TINTA);
    (linha.porDia ?? []).slice(0, rotulosDias.length).forEach((v, j) => textoDireita(p, v, xDia(j + 1) - 6, y, 8, 'negrito', TINTA));
    textoDireita(p, linha.semana, xSem, y, 9, 'negrito', TINTA);
    textoDireita(p, linha.mes, xMes, y, 9, 'negrito', hex(cor));
  });
}

export function gerarSetorUsinaPdf(d: DadosRelatorio, tril: TrilheirosRelatorio, setor: SetorPdf, modo: 'semanal' | 'diario' = 'semanal'): Buffer {
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
  textoDireita(p, 'SEGUNDA A DOMINGO', L - M, H - 26, 7, 'negrito', CINZA);
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

  const chaveSetor = SETOR_DA_OBSERVACAO[setor];
  const obsLinhas = chaveSetor
    ? Object.entries(d.observacoes)
        .filter(([chave, texto]) => chave.endsWith(`|${chaveSetor}`) && texto)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([chave, texto]) => {
          const dataIso = chave.split('|')[0]!;
          const dia = NOME_DIA_SEMANA[new Date(`${dataIso}T12:00:00Z`).getUTCDay()];
          return `${dia} ${brDaIso(dataIso)}: ${texto}`;
        })
    : [];
  // Caixa de observações no pé da folha, quando o setor tem alguma observação na semana.
  const altObs = obsLinhas.length > 0 ? Math.min(40 + obsLinhas.length * 11, 130) : 0;
  const alturaDisponivel = topoCorpo - 44 - altObs - (altObs > 0 ? 10 : 0);
  if (altObs > 0) {
    const topoObs = 44 + altObs;
    p.arredondado(M, topoObs - altObs, L - 2 * M, altObs, 9, BRANCO, LINHA);
    p.texto('OBSERVAÇÕES DA SEMANA', M + 10, topoObs - 14, 7, 'negrito', CINZA);
    obsLinhas.slice(0, Math.floor((altObs - 22) / 11)).forEach((linha, i) => {
      p.texto(linha, M + 10, topoObs - 28 - i * 11, 8, 'normal', TINTA);
    });
  }
  if (setor === 'trilheiros') {
    const altTril = Math.min(alturaDisponivel, 60 + Math.max(1, tril.equipes.length) * 40 + 12);
    desenharTrilheiros(p, tril, M, topoCorpo, L - 2 * M, altTril);
  } else if (modo === 'diario') {
    const s = d.setores.find((x) => x.titulo === TITULO_SETOR[setor]);
    if (s) desenharGradeDiaria(p, s.linhas, s.cor, d.rotulosDias, M, topoCorpo, L - 2 * M);
  } else {
    const s = d.setores.find((x) => x.titulo === TITULO_SETOR[setor]);
    if (s) desenharSetor(p, s, M, topoCorpo, L - 2 * M, Math.min(alturaDisponivel, 340), true, d.rotulosDias);
  }

  p.linha(M, 30, L - M, 30, LINHA, 0.6);
  p.texto(`Emitido em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, M, 18, 6.5, 'normal', CINZA);
  textoDireita(p, 'Controle de Trilhos · Usina', L - M, 18, 6.5, 'negrito', CINZA);

  return montarPdfVarias([p], `${TITULO_RELATORIO[setor]} ${d.data}`, A4_PAISAGEM);
}
