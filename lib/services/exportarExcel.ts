import ExcelJS from 'exceljs';
import { arredondar3 } from '@/lib/domain/regras';
import type { MovimentacaoRelatorio } from '@/lib/services/relatorio';

const TIPO_REMETIDO_LABEL: Record<string, string> = {
  VENDA: 'Venda',
  TRANS: 'Transferência',
  INDUS: 'Industrialização',
};

const STATUS_LABEL: Record<string, string> = {
  AGUARDANDO_CHEGADA: 'Aguardando chegada',
  PENDENTE_CONFERENCIA: 'Pendente de conferência',
  CONFERIDO: 'Conferido',
};

function classificacoesSC(medicoes: { classificacaoSC: string | null }[]): string {
  return [...new Set(medicoes.map((m) => m.classificacaoSC).filter((v): v is string => Boolean(v)))].join(', ');
}

const CABECALHO_COMUM = ['Data', 'NF'] as const;

function aplicarCabecalho(sheet: ExcelJS.Worksheet, colunas: string[]) {
  sheet.addRow(colunas);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };
}

function montarRecebidos(sheet: ExcelJS.Worksheet, movimentacoes: MovimentacaoRelatorio[]) {
  aplicarCabecalho(sheet, [
    ...CABECALHO_COMUM,
    'Origem',
    'Transporte',
    'Placa cavalo',
    'Placa carreta',
    'Transportadora',
    'Responsável (Pátio)',
    'Status',
    'Perfil',
    'Material',
    'Classificação',
    'Fabricante',
    'Classificação SC',
    'Metros',
    'Peso (t)',
    'Peso pendente',
  ]);

  for (const mov of movimentacoes) {
    const base = [
      mov.dataMovimentacao,
      mov.numeroDocumento ?? '',
      mov.origem ?? '',
      mov.tipoTransporte,
      mov.placaCavalo ?? '',
      mov.placaCarreta ?? '',
      mov.transportadora ?? '',
      mov.responsavelPatio ?? '',
      STATUS_LABEL[mov.status] ?? mov.status,
    ];

    const gruposSucata = mov.grupos.filter((g) => g.tipoMaterial === 'SUCATA');
    const gruposNaoSucata = mov.grupos.filter((g) => g.tipoMaterial !== 'SUCATA');

    for (const g of gruposNaoSucata) {
      sheet.addRow([
        ...base,
        g.perfil,
        g.tipoMaterial,
        g.classificacao ?? '',
        g.fabricante ?? '',
        '',
        Number(g.metrosTotal),
        g.pesoCalculado != null ? Number(g.pesoCalculado) : null,
        '',
      ]);
    }

    // Sucata, em Recebimento, tem peso real único por Movimentacao (nunca por Grupo) —
    // uma única linha combinada evita contar o mesmo peso várias vezes na planilha.
    if (gruposSucata.length > 0) {
      const perfis = [...new Set(gruposSucata.map((g) => g.perfil))].join(', ');
      const metros = arredondar3(gruposSucata.reduce((acc, g) => acc + Number(g.metrosTotal), 0));
      const medicoes = gruposSucata.flatMap((g) => g.medicoes);
      sheet.addRow([
        ...base,
        perfis,
        'SUCATA',
        '',
        '',
        classificacoesSC(medicoes),
        metros,
        mov.pesoSucataReal != null ? Number(mov.pesoSucataReal) : null,
        mov.pesoSucataReal == null ? 'SIM' : '',
      ]);
    }
  }

  sheet.getColumn(1).numFmt = 'dd/mm/yyyy';
  sheet.getColumn(15).numFmt = '0.00'; // Metros
  sheet.getColumn(16).numFmt = '0.000'; // Peso (t)
  sheet.columns.forEach((c) => (c.width = 16));
}

function montarRemetidos(sheet: ExcelJS.Worksheet, movimentacoes: MovimentacaoRelatorio[]) {
  aplicarCabecalho(sheet, [
    ...CABECALHO_COMUM,
    'Tipo remetido',
    'Reserva/Pedido',
    'Destino',
    'Placa cavalo',
    'Placa carreta',
    'Transportadora',
    'Responsável (Pátio)',
    'Status',
    'Perfil',
    'Material',
    'Classificação',
    'Tampão',
    'Fabricante',
    'Classificação SC',
    'Metros',
    'Peso informado (t)',
  ]);

  for (const mov of movimentacoes) {
    const base = [
      mov.dataMovimentacao,
      mov.numeroDocumento ?? '',
      TIPO_REMETIDO_LABEL[mov.remetidoDetalhe?.tipoRemetido ?? ''] ?? '',
      mov.reservaPedido ?? '',
      mov.destino ?? '',
      mov.placaCavalo ?? '',
      mov.placaCarreta ?? '',
      mov.transportadora ?? '',
      mov.responsavelPatio ?? '',
      STATUS_LABEL[mov.status] ?? mov.status,
    ];

    if (mov.grupos.length === 0) {
      // Pré-cadastro ainda aguardando o Pátio confirmar a chegada — sem grupos ainda.
      sheet.addRow([...base, '', '', '', '', '', '', '', null]);
      continue;
    }

    for (const g of mov.grupos) {
      sheet.addRow([
        ...base,
        g.perfil,
        g.tipoMaterial,
        g.classificacao ?? '',
        g.tipoMaterial === 'REEMPREGO' ? (g.tampao ? 'SIM' : 'NÃO') : '',
        g.fabricante ?? '',
        g.tipoMaterial === 'SUCATA' ? classificacoesSC(g.medicoes) : '',
        Number(g.metrosTotal),
        g.pesoInformado != null ? Number(g.pesoInformado) : null,
      ]);
    }
  }

  sheet.getColumn(1).numFmt = 'dd/mm/yyyy';
  sheet.getColumn(17).numFmt = '0.00'; // Metros
  sheet.getColumn(18).numFmt = '0.000'; // Peso informado (t)
  sheet.columns.forEach((c) => (c.width = 16));
}

export async function gerarRelatorioExcel(movimentacoes: MovimentacaoRelatorio[]): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Controle de Trilhos';
  workbook.created = new Date();

  montarRecebidos(workbook.addWorksheet('Recebidos'), movimentacoes.filter((m) => m.tipo === 'RECEBIMENTO'));
  montarRemetidos(workbook.addWorksheet('Remetidos'), movimentacoes.filter((m) => m.tipo === 'REMETIDO'));

  return workbook.xlsx.writeBuffer();
}
