import { PaginaPdf, A4_PAISAGEM, montarPdfVarias, quebrarLinhas, larguraTexto } from '@/lib/pdf/simples';
import { nfsEmTexto } from '@/lib/nf';
import { normalizarLocal } from '@/lib/domain/local';
import { pecasDoGrupo } from '@/lib/domain/regras';
import { fmtMetros, fmtPeso } from '@/lib/format';
import { pesoMovimentacao, resumoRelatorio, type MovimentacaoRelatorio } from '@/lib/services/relatorio';
import type { FiltrosRelatorioInput } from '@/lib/validation/relatorio';

type Cor = [number, number, number];

const AZUL: Cor = [0.07, 0.15, 0.3];
const AZUL_CLARO: Cor = [0.75, 0.82, 0.95];
const CINZA: Cor = [0.42, 0.45, 0.5];
const TINTA: Cor = [0.1, 0.12, 0.16];
const FUNDO_CARD: Cor = [0.95, 0.96, 0.98];
const FUNDO_CABECALHO: Cor = [0.89, 0.92, 0.97];
const BRANCO: Cor = [1, 1, 1];

const L = A4_PAISAGEM.largura;
const H = A4_PAISAGEM.altura;
const MARGEM = 36;
const LARGURA_UTIL = L - MARGEM * 2;
const TOPO_CONTEUDO = H - 54 - 22; // abaixo da faixa do cabeçalho
const FUNDO_PAGINA = 56; // reserva para o rodapé
const TAM = 8.5;
const ALTURA_LINHA = 11;

const STATUS_TEXTO: Record<string, string> = {
  AGUARDANDO_CHEGADA: 'Aguardando chegada',
  PENDENTE_CONFERENCIA: 'Pendente de conferência',
  CONFERIDO: 'Conferido',
};

interface Coluna {
  titulo: string;
  largura: number;
  alinhamento: 'esq' | 'dir';
  /** Fração da largura usada para quebrar o texto. Colunas de texto livre usam folga (maiúsculas são mais largas que a estimativa). */
  fatorQuebra: number;
}

// Soma = LARGURA_UTIL (770 pt).
const COLUNAS: Coluna[] = [
  { titulo: 'Data', largura: 62, alinhamento: 'esq', fatorQuebra: 1 },
  { titulo: 'Tipo', largura: 74, alinhamento: 'esq', fatorQuebra: 1 },
  { titulo: 'NF', largura: 120, alinhamento: 'esq', fatorQuebra: 0.8 },
  { titulo: 'Origem/Destino', largura: 170, alinhamento: 'esq', fatorQuebra: 0.8 },
  { titulo: 'Status', largura: 150, alinhamento: 'esq', fatorQuebra: 0.8 },
  { titulo: 'Peças', largura: 50, alinhamento: 'dir', fatorQuebra: 1 },
  { titulo: 'Metros (m)', largura: 70, alinhamento: 'dir', fatorQuebra: 1 },
  { titulo: 'Toneladas (t)', largura: 74, alinhamento: 'dir', fatorQuebra: 1 },
];

function dataCurta(d: Date | null): string {
  return d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
}

function dataHora(d: Date): string {
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}

function isoParaBr(iso: string | undefined): string | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/** Lista legível dos filtros aplicados, para o cabeçalho do PDF. */
export function descreverFiltros(filtros: FiltrosRelatorioInput): string {
  const partes: string[] = [];
  if (filtros.dataInicio || filtros.dataFim) {
    partes.push(`Período: ${isoParaBr(filtros.dataInicio) ?? 'desde o início'} até ${isoParaBr(filtros.dataFim) ?? 'hoje'}`);
  }
  if (filtros.tipo) partes.push(`Tipo: ${filtros.tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Remetido'}`);
  if (filtros.status) partes.push(`Status: ${STATUS_TEXTO[filtros.status]}`);
  if (filtros.perfil) partes.push(`Perfil: ${filtros.perfil}`);
  if (filtros.material) partes.push(`Material: ${filtros.material}`);
  if (filtros.classificacao) partes.push(`Classificação: ${filtros.classificacao}`);
  if (filtros.origemDestino) partes.push(`Origem/Destino: ${normalizarLocal(filtros.origemDestino)}`);
  if (filtros.numeroDocumento) partes.push(`NF: ${filtros.numeroDocumento}`);
  if (filtros.placa) partes.push(`Placa: ${filtros.placa}`);
  return partes.length > 0 ? partes.join('  ·  ') : 'Sem filtros: todo o histórico.';
}

function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** "relatorio-movimentacao-evangelista.pdf" — nome seguro para download, com o filtro de origem/destino quando houver. */
export function nomeArquivoRelatorioMovimentacao(filtros: FiltrosRelatorioInput): string {
  const partes = ['relatorio-movimentacao'];
  if (filtros.origemDestino) partes.push(slug(filtros.origemDestino));
  if (filtros.dataInicio) partes.push(`desde-${filtros.dataInicio}`);
  if (filtros.dataFim) partes.push(`ate-${filtros.dataFim}`);
  return `${partes.filter(Boolean).join('-')}.pdf`;
}

interface LinhaRelatorio {
  valores: string[];
}

function linhaDe(mov: MovimentacaoRelatorio): LinhaRelatorio {
  const pecas = mov.grupos.reduce((acc, g) => acc + pecasDoGrupo(g.medicoes), 0);
  const metros = mov.grupos.reduce((acc, g) => acc + Number(g.metrosTotal), 0);
  return {
    valores: [
      dataCurta(mov.dataMovimentacao),
      mov.tipo === 'RECEBIMENTO' ? 'Recebimento' : 'Remetido',
      nfsEmTexto(mov) || 'Em aberto',
      normalizarLocal(mov.tipo === 'RECEBIMENTO' ? mov.origem : mov.destino) || '—',
      STATUS_TEXTO[mov.status] ?? mov.status,
      String(pecas),
      fmtMetros(metros),
      fmtPeso(pesoMovimentacao(mov)),
    ],
  };
}

/**
 * PDF de relatório de movimentação (para baixar, não para imprimir): cabeçalho com os filtros
 * aplicados, totais, e a lista de movimentações em ordem cronológica. A tabela repete o cabeçalho
 * em cada página.
 */
export function gerarRelatorioMovimentacaoPdf(
  movimentacoes: MovimentacaoRelatorio[],
  filtros: FiltrosRelatorioInput,
  emitidoEm: Date = new Date(),
): Buffer {
  const paginas: PaginaPdf[] = [];
  const resumo = resumoRelatorio(movimentacoes);
  const ordenadas = [...movimentacoes].sort((a, b) => (a.dataMovimentacao?.getTime() ?? 0) - (b.dataMovimentacao?.getTime() ?? 0));

  let pagina = novaPagina();
  let y = TOPO_CONTEUDO;

  function novaPagina(): PaginaPdf {
    const pg = new PaginaPdf();
    paginas.push(pg);
    pg.retangulo(0, H - 54, L, 54, AZUL);
    pg.texto('CONTROLE DE TRILHOS', MARGEM, H - 22, 9, 'negrito', AZUL_CLARO);
    pg.texto('Relatório de movimentação', MARGEM, H - 42, 18, 'negrito', BRANCO);
    const emitido = `Emitido em ${dataHora(emitidoEm)}`;
    pg.texto(emitido, L - MARGEM - larguraTexto(emitido, 9), H - 42, 9, 'normal', AZUL_CLARO);
    return pg;
  }

  function cabecalhoTabela() {
    pagina.retangulo(MARGEM, y - 18, LARGURA_UTIL, 18, FUNDO_CABECALHO);
    let x = MARGEM;
    for (const col of COLUNAS) {
      const tx = col.alinhamento === 'dir' ? x + col.largura - 6 - larguraTexto(col.titulo, TAM, 'negrito') : x + 6;
      pagina.texto(col.titulo, tx, y - 12, TAM, 'negrito', TINTA);
      x += col.largura;
    }
    y -= 18;
  }

  function garantirEspaco(altura: number) {
    if (y - altura >= FUNDO_PAGINA) return;
    pagina = novaPagina();
    y = TOPO_CONTEUDO;
    cabecalhoTabela();
  }

  // Filtros aplicados.
  for (const linha of quebrarLinhas(descreverFiltros(filtros), 9, LARGURA_UTIL)) {
    pagina.texto(linha, MARGEM, y, 9, 'normal', CINZA);
    y -= 13;
  }
  y -= 8;

  // Totais em cartões.
  const cards: Array<[string, string]> = [
    ['Movimentações', String(resumo.carregamentos)],
    ['Peças', String(resumo.pecas)],
    ['Metros', `${fmtMetros(resumo.metros)} m`],
    ['Toneladas', `${fmtPeso(resumo.toneladas)} t`],
  ];
  const gap = 12;
  const cardLargura = (LARGURA_UTIL - gap * 3) / 4;
  cards.forEach(([rotulo, valor], i) => {
    const x = MARGEM + i * (cardLargura + gap);
    pagina.retangulo(x, y - 50, cardLargura, 50, FUNDO_CARD);
    pagina.texto(rotulo.toUpperCase(), x + 10, y - 16, 8, 'normal', CINZA);
    pagina.texto(valor, x + 10, y - 38, 16, 'negrito', TINTA);
  });
  y -= 50 + 22;

  pagina.texto(`Movimentações (${movimentacoes.length})`, MARGEM, y, 11, 'negrito', TINTA);
  y -= 16;
  cabecalhoTabela();

  if (ordenadas.length === 0) {
    garantirEspaco(ALTURA_LINHA + 16);
    pagina.texto('Nenhuma movimentação com esses filtros.', MARGEM + 6, y - 12, TAM, 'normal', CINZA);
    y -= 26;
  }

  for (const mov of ordenadas) {
    const { valores } = linhaDe(mov);
    const celulas = COLUNAS.map((col, i) => quebrarLinhas(valores[i], TAM, (col.largura - 12) * col.fatorQuebra));
    const linhas = Math.max(...celulas.map((c) => c.length));
    const altura = linhas * ALTURA_LINHA + 8;
    garantirEspaco(altura);

    let x = MARGEM;
    COLUNAS.forEach((col, i) => {
      celulas[i].forEach((texto, j) => {
        const tx = col.alinhamento === 'dir' ? x + col.largura - 6 - larguraTexto(texto, TAM) : x + 6;
        pagina.texto(texto, tx, y - 11 - j * ALTURA_LINHA, TAM);
      });
      x += col.largura;
    });
    pagina.linha(MARGEM, y - altura, MARGEM + LARGURA_UTIL, y - altura);
    y -= altura;
  }

  // Linha de totais, sempre no fim da tabela.
  garantirEspaco(22);
  pagina.retangulo(MARGEM, y - 22, LARGURA_UTIL, 22, FUNDO_CABECALHO);
  const totais = ['Total', '', '', '', '', String(resumo.pecas), fmtMetros(resumo.metros), fmtPeso(resumo.toneladas)];
  let xt = MARGEM;
  COLUNAS.forEach((col, i) => {
    if (totais[i]) {
      const tx = col.alinhamento === 'dir' ? xt + col.largura - 6 - larguraTexto(totais[i], TAM, 'negrito') : xt + 6;
      pagina.texto(totais[i], tx, y - 14, TAM, 'negrito', TINTA);
    }
    xt += col.largura;
  });

  // Rodapé em todas as páginas, com a numeração no total.
  paginas.forEach((pg, i) => {
    pg.linha(MARGEM, 34, L - MARGEM, 34);
    pg.texto('Controle de Trilhos', MARGEM, 22, 8, 'normal', CINZA);
    const numeracao = `Página ${i + 1} de ${paginas.length}`;
    pg.texto(numeracao, L - MARGEM - larguraTexto(numeracao, 8), 22, 8, 'normal', CINZA);
  });

  return montarPdfVarias(paginas, 'Relatório de movimentação', A4_PAISAGEM);
}
