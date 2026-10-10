import ExcelJS from 'exceljs';
import type { MovimentacaoRelatorio } from '@/lib/services/relatorio';
import { pecasDoGrupo } from '@/lib/domain/regras';

/**
 * Estrutura de colunas das duas abas (Bloco 5): segue EXATAMENTE a planilha
 * real da empresa, para copiar e colar sem remapeamento — ordem, nomes de
 * coluna e o padrão de linha em branco (nunca zero/"-") são requisitos do
 * usuário, não escolha de design.
 *
 * DECISÃO INTERPRETATIVA (reportar ao usuário para validação — não há
 * planilha/exemplo real disponível neste repositório para conferir contra):
 * uma linha por GRUPO (mesma granularidade que o resto do app já usa), não
 * uma linha agregada por perfil. As colunas G1/G2/G3 e SC-1/SC-2-L/SC-3 do
 * Recebidos existem para abrigar o caso em que um grupo de SUCATA tem
 * medições com classificações SC diferentes entre si (SC é por medição, não
 * por grupo — ver design spec) — cada coluna recebe a soma de metros das
 * medições daquela classificação, e as colunas que não se aplicam ao
 * material da linha ficam em branco (nunca 0). "Em Classificação" fica
 * sempre vazia de propósito: é um estado do fluxo legado que este app nunca
 * produz (toda medição de sucata já nasce classificada), mas a coluna
 * precisa existir para manter o alinhamento ao colar nas colunas da
 * planilha mestra.
 */

const TIPO_REMETIDO_LABEL: Record<string, string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

// Marcas de fabricante cadastradas (lib/validation/recebimento.ts#MARCA_LABEL)
// — qualquer outro texto em Grupo.fabricante só pode ter vindo do campo livre
// de "Outros", e por isso é maiúsculizado (Bloco 5.2). O Grupo não guarda o
// enum `marca` original, só o texto já resolvido — esta é a única forma de
// diferenciar os dois casos a partir do que fica persistido.
const MARCAS_CADASTRADAS = new Set(['Nippon', 'Evraz', 'Pangang']);

// Rótulo de exibição da classificação de Sucata — "SC-2 - L" é o nome exato
// pedido pelo usuário (não "SC-2"), mantido literal nas duas abas.
const SC_LABEL: Record<string, string> = {
  SC1: 'SC-1',
  SC2: 'SC-2 - L',
  SC3: 'SC-3',
};

type Grupo = MovimentacaoRelatorio['grupos'][number];
type Medicao = Grupo['medicoes'][number];

function upper(v: string | null | undefined): string {
  return v ? v.toUpperCase() : '';
}

/** Mantém o nome registrado como está; maiúsculiza só texto livre ("Outros"). */
function upperSeCustomizado(v: string | null | undefined): string {
  if (!v) return '';
  return MARCAS_CADASTRADAS.has(v) ? v : v.toUpperCase();
}

/** "TR57" -> "TRILHOS TR-57" — nunca truncado (Bloco 5.1). */
function descricaoPerfil(perfil: string): string {
  return `TRILHOS ${perfil.slice(0, 2)}-${perfil.slice(2)}`;
}

function metrosPorSC(medicoes: Medicao[], sc: 'SC1' | 'SC2' | 'SC3'): number | null {
  const soma = medicoes
    .filter((m) => m.classificacaoSC === sc)
    .reduce((acc, m) => acc + Number(m.metros), 0);
  return soma > 0 ? Math.round(soma * 100) / 100 : null;
}

/**
 * Placa da célula única que a planilha espera: prioriza a(s) carreta(s) —
 * é a informação que a operação usa — com o cavalo só como complemento ou
 * fallback (Bloco 5.1, decisão a confirmar com o usuário).
 */
function formatarPlaca(mov: { placaCavalo: string | null; placaCarreta: string | null; placaCarreta2: string | null }): string {
  const carretas = [mov.placaCarreta, mov.placaCarreta2].filter(Boolean);
  if (carretas.length > 0) {
    return mov.placaCavalo ? `${carretas.join('/')} (${mov.placaCavalo})` : carretas.join('/');
  }
  return mov.placaCavalo ?? '';
}

function diaMesAno(d: Date | null): [number | null, number | null, number | null] {
  if (!d) return [null, null, null];
  return [d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()];
}

function aplicarCabecalho(sheet: ExcelJS.Worksheet, colunas: string[]) {
  sheet.addRow(colunas);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };
  sheet.columns.forEach((c) => (c.width = 16));
}

function montarRecebidos(sheet: ExcelJS.Worksheet, movimentacoes: MovimentacaoRelatorio[]) {
  aplicarCabecalho(sheet, [
    'Dia',
    'Mês',
    'Ano',
    'Tipo do documento',
    'Número',
    'Tipo de transporte',
    'Placa',
    'Qtd. de vagões',
    'Origem',
    'Descrição do perfil',
    'Fabricante',
    'Qtd. de peças',
    'Peso (Ton.)',
    'G1',
    'G2',
    'G3',
    'Total',
    'SC-1',
    'SC-2 - L',
    'SC-3',
    'Em Classificação',
    'Total',
    'Novo',
    'Total',
  ]);

  for (const mov of movimentacoes) {
    const [dia, mes, ano] = diaMesAno(mov.dataMovimentacao);
    const placa = formatarPlaca(mov);
    const base = [
      dia,
      mes,
      ano,
      mov.tipoDocumento,
      mov.numeroDocumento ?? '',
      mov.tipoTransporte,
      placa,
      '', // Qtd. de vagões — não capturado pelo app (só Caminhão existe hoje)
      upper(mov.origem),
    ];

    for (const g of mov.grupos) {
      const metros = Number(g.metrosTotal);
      const ehNovo = g.tipoMaterial === 'NOVO';
      const ehReemprego = g.tipoMaterial === 'REEMPREGO';
      const ehSucata = g.tipoMaterial === 'SUCATA';

      const g1 = ehReemprego && g.classificacao === 'G1' ? metros : null;
      const g2 = ehReemprego && g.classificacao === 'G2' ? metros : null;
      const g3 = ehReemprego && g.classificacao === 'G3' ? metros : null;
      const totalReemprego = ehReemprego ? metros : null;

      const sc1 = ehSucata ? metrosPorSC(g.medicoes, 'SC1') : null;
      const sc2 = ehSucata ? metrosPorSC(g.medicoes, 'SC2') : null;
      const sc3 = ehSucata ? metrosPorSC(g.medicoes, 'SC3') : null;
      const totalSucata = ehSucata ? metros : null;

      sheet.addRow([
        ...base,
        descricaoPerfil(g.perfil),
        ehNovo ? upperSeCustomizado(g.fabricante) : '',
        pecasDoGrupo(g.medicoes),
        ehSucata ? null : g.pesoCalculado != null ? Number(g.pesoCalculado) : null,
        g1,
        g2,
        g3,
        totalReemprego,
        sc1,
        sc2,
        sc3,
        null, // Em Classificação — sempre vazia, ver nota no topo do arquivo
        totalSucata,
        ehNovo ? metros : null,
        metros,
      ]);
    }
  }

  sheet.getColumn(1).numFmt = '0';
  sheet.getColumn(2).numFmt = '0';
  sheet.getColumn(3).numFmt = '0';
}

function montarRemetidos(sheet: ExcelJS.Worksheet, movimentacoes: MovimentacaoRelatorio[]) {
  aplicarCabecalho(sheet, [
    'Dia',
    'Mês',
    'Ano',
    'Tipo do documento',
    'Nº NF',
    'Reserva/Pedido',
    'Tipo de transporte',
    'Placa',
    'Destino/Transportadora',
    'Perfil',
    'Tipo de material',
    'Marca',
    'Tipo/identificação',
    'Peças',
    'Metros',
    'Toneladas',
  ]);

  for (const mov of movimentacoes) {
    const [dia, mes, ano] = diaMesAno(mov.dataMovimentacao);
    const destinoTransportadora = [upper(mov.destino), mov.transportadora ? upper(mov.transportadora) : null]
      .filter(Boolean)
      .join(' / ');

    const base = [
      dia,
      mes,
      ano,
      mov.tipoDocumento,
      mov.numeroDocumento ?? '',
      upper(mov.reservaPedido),
      mov.tipoTransporte,
      formatarPlaca(mov),
      destinoTransportadora,
    ];

    if (mov.grupos.length === 0) {
      // Pré-cadastro ainda aguardando o Pátio confirmar a chegada — sem grupos ainda.
      sheet.addRow([...base, '', '', '', '', null, null, null]);
      continue;
    }

    for (const g of mov.grupos) {
      const ehNovo = g.tipoMaterial === 'NOVO';
      const ehReemprego = g.tipoMaterial === 'REEMPREGO';
      const ehSucata = g.tipoMaterial === 'SUCATA';

      const identificacao = ehReemprego
        ? (g.classificacao ?? '')
        : ehSucata
          ? [...new Set(g.medicoes.map((m) => m.classificacaoSC).filter((v): v is 'SC1' | 'SC2' | 'SC3' => Boolean(v)))]
              .map((sc) => SC_LABEL[sc])
              .join(', ')
          : '';

      const toneladas = g.pesoInformado != null ? Number(g.pesoInformado) : g.pesoCalculado != null ? Number(g.pesoCalculado) : null;

      sheet.addRow([
        ...base,
        g.perfil,
        g.tipoMaterial,
        ehNovo ? upperSeCustomizado(g.fabricante) : '',
        identificacao,
        pecasDoGrupo(g.medicoes),
        Number(g.metrosTotal),
        toneladas,
      ]);
    }
  }

  sheet.getColumn(1).numFmt = '0';
  sheet.getColumn(2).numFmt = '0';
  sheet.getColumn(3).numFmt = '0';
}

/**
 * Times New Roman 10 (Task 25) — a planilha operacional usa essa fonte, e a
 * exportação precisa copiar/colar sem precisar reformatar. Aplicada por
 * último, depois que todas as linhas já existem, para cobrir a aba inteira
 * sem perder o negrito do cabeçalho (aplicarCabecalho já define `bold: true`
 * na linha 1 antes desta função rodar).
 */
function aplicarFontePadrao(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row) => {
    row.font = { ...row.font, name: 'Times New Roman', size: 10 };
  });
}

export async function gerarRelatorioExcel(movimentacoes: MovimentacaoRelatorio[]): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Controle de Trilhos';
  workbook.created = new Date();

  const recebidos = workbook.addWorksheet('Recebidos');
  const remetidos = workbook.addWorksheet('Remetidos');

  montarRecebidos(recebidos, movimentacoes.filter((m) => m.tipo === 'RECEBIMENTO'));
  montarRemetidos(remetidos, movimentacoes.filter((m) => m.tipo === 'REMETIDO'));

  aplicarFontePadrao(recebidos);
  aplicarFontePadrao(remetidos);

  return workbook.xlsx.writeBuffer();
}
