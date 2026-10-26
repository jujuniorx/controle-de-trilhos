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
  desenharResumoCartao,
  desenharSetor,
  hex,
  textoDireita,
} from '@/lib/pdf/onePageUsina';
import type { DadosRelatorio, LinhaRelatorio, TrilheirosRelatorio } from '@/lib/services/onePageUsina';
import { faixaSemanaSegSex, type Coluna, TODAS_COLUNAS } from '@/lib/usina/periodo';

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
function desenharGradeDiaria(p: PaginaPdf, linhas: LinhaRelatorio[], cor: string, rotulosDias: string[], x: number, topo: number, w: number, titulo: string, colunas: Coluna[] = TODAS_COLUNAS) {
  const mostraDia = colunas.includes('dia');
  const mostraSem = colunas.includes('semana');
  const mostraMes = colunas.includes('mes');
  const colLabel = 200;
  const colSemMes = 80;
  const colDia = (w - colLabel - 2 * colSemMes) / Math.max(1, rotulosDias.length);
  const xDia = (i: number) => x + colLabel + i * colDia;
  const xSem = x + colLabel + rotulosDias.length * colDia + colSemMes;
  const xMes = x + w - 8;
  const yCab = topo - 14;
  p.arredondado(x, topo - 22, w, 22, 9, hex(cor));
  p.retangulo(x, topo - 22, w, 8, hex(cor));
  p.texto(titulo.toUpperCase(), x + 10, topo - 14, 8, 'negrito', BRANCO);
  if (mostraDia) rotulosDias.forEach((r, i) => textoDireita(p, r.toUpperCase(), xDia(i + 1) - 6, yCab, 6.5, 'negrito', BRANCO));
  if (mostraSem) textoDireita(p, 'SEMANA', xSem, yCab, 6.5, 'negrito', BRANCO);
  if (mostraMes) textoDireita(p, 'NO MÊS', xMes, yCab, 6.5, 'negrito', BRANCO);
  let y = topo - 36;
  linhas.forEach((linha, i) => {
    y -= 20;
    if (i % 2 === 1) p.retangulo(x + 4, y - 6, w - 8, 20, ZEBRA);
    p.texto(linha.rotulo, x + 10, y, 8, 'normal', TINTA);
    if (mostraDia) (linha.porDia ?? []).slice(0, rotulosDias.length).forEach((v, j) => textoDireita(p, v, xDia(j + 1) - 6, y, 8, 'negrito', TINTA));
    if (mostraSem) textoDireita(p, linha.semana, xSem, y, 9, 'negrito', TINTA);
    if (mostraMes) textoDireita(p, linha.mes, xMes, y, 9, 'negrito', hex(cor));
  });
}

export function gerarSetorUsinaPdf(d: DadosRelatorio, tril: TrilheirosRelatorio, setor: SetorPdf, modo: 'semanal' | 'diario' = 'semanal', colunas: Coluna[] = TODAS_COLUNAS): Buffer {
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
    cards.forEach((r, i) => desenharResumoCartao(p, r, M + i * (wRes + gap), topoCards, wRes, altRes, colunas));
    topoCorpo = topoCards - altRes - 16;
  }

  const chaveSetor = SETOR_DA_OBSERVACAO[setor];
  // Observações só no diário: na semana elas não aparecem.
  const obsLinhas = chaveSetor && modo === 'diario'
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
    if (s) desenharGradeDiaria(p, s.linhas, s.cor, d.rotulosDias, M, topoCorpo, L - 2 * M, TITULO_SETOR[setor], colunas);
  } else {
    const s = d.setores.find((x) => x.titulo === TITULO_SETOR[setor]);
    if (s) desenharSetor(p, s, M, topoCorpo, L - 2 * M, Math.min(alturaDisponivel, 340), true, d.rotulosDias, false, colunas);
  }

  p.linha(M, 30, L - M, 30, LINHA, 0.6);
  p.texto(`Emitido em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, M, 18, 6.5, 'normal', CINZA);
  textoDireita(p, 'Controle de Trilhos · Usina', L - M, 18, 6.5, 'negrito', CINZA);

  return montarPdfVarias([p], `${TITULO_RELATORIO[setor]} ${d.data}`, A4_PAISAGEM);
}

/** Cabeçalho comum das páginas do gerencial diário. */
function cabecalhoPagina(p: PaginaPdf, titulo: string, data: string) {
  p.retangulo(0, 0, L, H, BRANCO);
  p.retangulo(0, H - 5, L, 5, NAVY);
  p.retangulo(0, H - 5, L * 0.35, 5, AZUL);
  p.texto('CONTROLE DE TRILHOS', M, H - 26, 7.5, 'negrito', AZUL);
  p.texto(titulo, M, H - 52, 21, 'negrito', TINTA);
  const semana = faixaSemanaSegSex(data);
  const wPilula = larguraTexto(semana, 10, 'negrito') + 26;
  p.arredondado(L - M - wPilula, H - 54, wPilula, 22, 11, hex('#e9f1fb'));
  textoDireita(p, semana, L - M - 13, H - 47, 10, 'negrito', NAVY);
  textoDireita(p, 'SEGUNDA A DOMINGO', L - M, H - 26, 7, 'negrito', CINZA);
  p.linha(M, H - 62, L - M, H - 62, LINHA, 0.8);
}

function rodapePagina(p: PaginaPdf) {
  p.linha(M, 30, L - M, 30, LINHA, 0.6);
  p.texto(`Emitido em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, M, 18, 6.5, 'normal', CINZA);
  textoDireita(p, 'Controle de Trilhos · Usina', L - M, 18, 6.5, 'negrito', CINZA);
}

/**
 * Gerencial no formato diário, em duas páginas:
 * 1) cards de resumo e tabela de trilheiros; 2) grade diária dos setores e observações do dia.
 */
export function gerarGerencialDiarioPdf(d: DadosRelatorio, tril: TrilheirosRelatorio, colunas: Coluna[] = TODAS_COLUNAS): Buffer {
  // Página 1: cards e trilheiros
  const p1 = new PaginaPdf();
  cabecalhoPagina(p1, 'Relatório gerencial', d.data);
  const gap = 10;
  const wRes = (L - 2 * M - (d.resumo.length - 1) * gap) / d.resumo.length;
  const topoRes = H - 70;
  const altRes = 64;
  d.resumo.forEach((r, i) => desenharResumoCartao(p1, r, M + i * (wRes + gap), topoRes, wRes, altRes, colunas));
  const obs = Object.entries(d.observacoes ?? {})
    .filter(([, texto]) => texto)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 6)
    .map(([chave, texto]) => {
      const [dataIso, setor] = chave.split('|');
      const nomeSetor = TITULO_SETOR[(setor === 'serra' ? 'composicoes' : setor) as SetorPdf] ?? setor;
      const dia = NOME_DIA_SEMANA[new Date(`${dataIso}T12:00:00Z`).getUTCDay()];
      return `${dia} ${brDaIso(dataIso!)} · ${nomeSetor}: ${texto}`;
    });
  // Observações do dia ficam na primeira página, embaixo dos trilheiros.
  const altObs = obs.length > 0 ? 40 + obs.length * 11 : 0;
  const topoTril = topoRes - altRes - 24;
  const altTril = Math.min(topoTril - 44 - altObs - (altObs > 0 ? 10 : 0), 60 + Math.max(1, tril.equipes.length) * 40 + 12);
  desenharTrilheiros(p1, tril, M, topoTril, L - 2 * M, altTril);
  if (altObs > 0) {
    const base = 44;
    p1.arredondado(M, base, L - 2 * M, altObs, 9, BRANCO, LINHA);
    p1.texto('OBSERVAÇÕES DA SEMANA', M + 10, base + altObs - 14, 7, 'negrito', CINZA);
    obs.forEach((linha, i) => p1.texto(linha, M + 10, base + altObs - 28 - i * 11, 8, 'normal', TINTA));
  }
  rodapePagina(p1);

  // Página 2: grade diária dos setores (uma por setor, um dia por coluna)
  const p2 = new PaginaPdf();
  cabecalhoPagina(p2, 'Detalhe diário da usina', d.data);
  let topo = H - 80;
  for (const s of d.setores.filter((x) => x.titulo !== 'Trilheiros')) {
    desenharGradeDiaria(p2, s.linhas, s.cor, d.rotulosDias, M, topo, L - 2 * M, s.titulo, colunas);
    topo -= 36 + s.linhas.length * 20 + 14;
  }
  rodapePagina(p2);

  return montarPdfVarias([p1, p2], `Relatório gerencial usina ${d.data}`, A4_PAISAGEM);
}
