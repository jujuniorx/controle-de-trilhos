import ExcelJS from 'exceljs';
import type { MovimentacaoRelatorio } from '@/lib/services/relatorio';
import { pecasDoGrupo, arredondar3 } from '@/lib/domain/regras';

/**
 * Estrutura de colunas das duas abas: segue a planilha real da empresa, para
 * copiar e colar sem remapeamento — ordem das colunas, "TRILHOS TR-57", códigos
 * em maiúsculas e o padrão de célula vazia são requisitos do usuário.
 *
 * GRANULARIDADE (confirmada com a planilha real):
 * - Recebidos: UMA linha por TRILHO (perfil) dentro de cada nota. Reemprego
 *   (G1/G2/G3), sucata (SC-1/SC-2 - L/SC-3) e novo do mesmo perfil entram na
 *   MESMA linha, cada um na sua coluna — a planilha é filtrada por trilho, então
 *   o mesmo trilho nunca pode aparecer em duas linhas da mesma nota. Perfis
 *   diferentes continuam em linhas separadas.
 * - Remetidos: o material (NOVO, TAMPÃO, REEMPREGO G1, SUCATA) é uma COLUNA, não
 *   várias colunas; então a linha é por trilho + tipo de material.
 *
 * Colunas de Recebidos G1/G2/G3 e SC-1/SC-2 - L/SC-3 recebem a soma de metros
 * da classificação; as que não se aplicam ficam em branco (nunca 0). "Em
 * Classificação" fica sempre vazia de propósito: é um estado do fluxo legado que
 * este app nunca produz, mas a coluna precisa existir para manter o alinhamento.
 * Em Remetidos, "Baixa — Reserva", "Depósito destino" e "Considerar real meta" são
 * preenchidos à mão na planilha mestra (o app não captura): saem em branco.
 */

// Ordem dos materiais nas linhas de um mesmo trilho (aba Remetidos).
const ORDEM_MATERIAL = ['NOVO', 'REEMPREGO', 'SUCATA'] as const;

type Grupo = MovimentacaoRelatorio['grupos'][number];
type Medicao = Grupo['medicoes'][number];

function upper(v: string | null | undefined): string {
  return v ? v.toUpperCase() : '';
}

/** "TR57" -> "TRILHOS TR-57" — nunca truncado. */
function descricaoPerfil(perfil: string): string {
  return `TRILHOS ${perfil.slice(0, 2)}-${perfil.slice(2)}`;
}

function numeroDoPerfil(perfil: string): number {
  return Number(perfil.slice(2));
}

function arredondar2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Soma só os valores presentes; sem nenhum, devolve null (célula em branco — nunca 0). */
function somaOuNull(valores: (number | null | undefined)[], arredondar: (n: number) => number): number | null {
  const presentes = valores.filter((v): v is number => v != null);
  return presentes.length > 0 ? arredondar(presentes.reduce((a, b) => a + b, 0)) : null;
}

function unicos(valores: (string | null | undefined)[]): string[] {
  return [...new Set(valores.filter((v): v is string => Boolean(v)))];
}

function metrosPorSC(medicoes: Medicao[], sc: 'SC1' | 'SC2' | 'SC3'): number | null {
  const soma = medicoes.filter((m) => m.classificacaoSC === sc).reduce((acc, m) => acc + Number(m.metros), 0);
  return soma > 0 ? arredondar2(soma) : null;
}

/**
 * A planilha tem uma célula de placa só: as carretas (separadas por "/") — é a
 * informação que a operação usa — ou, sem carreta, o cavalo.
 */
function formatarPlaca(mov: { placaCavalo: string | null; placaCarreta: string | null; placaCarreta2: string | null }): string {
  const carretas = [mov.placaCarreta, mov.placaCarreta2].filter(Boolean);
  return carretas.length > 0 ? carretas.join('/') : (mov.placaCavalo ?? '');
}

function diaMesAno(d: Date | null): [number | null, number | null, number | null] {
  if (!d) return [null, null, null];
  return [d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()];
}

/** Dia e mês com zero à esquerda (01, 09), como na planilha; ano inteiro. */
function formatarColunasDeData(sheet: ExcelJS.Worksheet) {
  // Por célula (e não só por coluna): é o que garante o "01" em qualquer leitor de xlsx.
  sheet.eachRow((row, numero) => {
    if (numero === 1) return; // cabeçalho
    row.getCell(1).numFmt = '00';
    row.getCell(2).numFmt = '00';
    row.getCell(3).numFmt = '0';
  });
}

function aplicarCabecalho(sheet: ExcelJS.Worksheet, colunas: string[]) {
  sheet.addRow(colunas);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };
  sheet.columns.forEach((c) => (c.width = 16));
}

/** Agrupa os grupos de uma nota pelo perfil, em ordem crescente (TR-45, TR-55, TR-57, TR-60, TR-68...). */
function agruparPorPerfil(grupos: Grupo[]): Grupo[][] {
  const porPerfil = new Map<string, Grupo[]>();
  for (const g of grupos) porPerfil.set(g.perfil, [...(porPerfil.get(g.perfil) ?? []), g]);
  return [...porPerfil.entries()].sort(([a], [b]) => numeroDoPerfil(a) - numeroDoPerfil(b)).map(([, lista]) => lista);
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
    const base = [
      dia,
      mes,
      ano,
      mov.tipoDocumento,
      mov.numeroDocumento ?? '',
      mov.tipoTransporte,
      formatarPlaca(mov),
      '-', // Qtd. de vagões — não capturado pelo app (só Caminhão existe hoje)
      upper(mov.origem),
    ];

    for (const grupos of agruparPorPerfil(mov.grupos)) {
      const metros = (g: Grupo) => Number(g.metrosTotal);
      const novos = grupos.filter((g) => g.tipoMaterial === 'NOVO');
      const reempregos = grupos.filter((g) => g.tipoMaterial === 'REEMPREGO');
      const sucatas = grupos.filter((g) => g.tipoMaterial === 'SUCATA');
      const medicoesSucata = sucatas.flatMap((g) => g.medicoes);

      const metrosReemprego = (classe: 'G1' | 'G2' | 'G3') =>
        somaOuNull(reempregos.filter((g) => g.classificacao === classe).map(metros), arredondar2);

      const fabricantes = unicos(novos.map((g) => upper(g.fabricante)));

      sheet.addRow([
        ...base,
        descricaoPerfil(grupos[0].perfil),
        fabricantes.length > 0 ? fabricantes.join(' / ') : '-',
        grupos.reduce((acc, g) => acc + pecasDoGrupo(g.medicoes), 0),
        // Peso estimado do que NÃO é sucata — o peso real da sucata é conferido à parte (pesoSucataReal).
        somaOuNull(
          grupos.filter((g) => g.tipoMaterial !== 'SUCATA').map((g) => (g.pesoCalculado != null ? Number(g.pesoCalculado) : null)),
          arredondar3,
        ),
        metrosReemprego('G1'),
        metrosReemprego('G2'),
        metrosReemprego('G3'),
        somaOuNull(reempregos.map(metros), arredondar2),
        metrosPorSC(medicoesSucata, 'SC1'),
        metrosPorSC(medicoesSucata, 'SC2'),
        metrosPorSC(medicoesSucata, 'SC3'),
        null, // Em Classificação — sempre vazia, ver nota no topo do arquivo
        somaOuNull(sucatas.map(metros), arredondar2),
        somaOuNull(novos.map(metros), arredondar2),
        arredondar2(grupos.reduce((acc, g) => acc + metros(g), 0)),
      ]);
    }
  }

  formatarColunasDeData(sheet);
}

/** Valor da coluna "Tipo" do MATERIAL na planilha: NOVO, TAMPÃO, REEMPREGO G1, SUCATA. */
function rotuloMaterial(g: Grupo): string {
  if (g.tipoMaterial === 'NOVO') return 'NOVO';
  if (g.tipoMaterial === 'SUCATA') return 'SUCATA';
  if (g.tampao) return 'TAMPÃO';
  return g.classificacao ? `REEMPREGO ${g.classificacao}` : 'REEMPREGO';
}

/** Ordem das linhas de um mesmo trilho: NOVO, depois REEMPREGO/TAMPÃO, depois SUCATA. */
function ordemDoMaterial(g: Grupo): number {
  return ORDEM_MATERIAL.indexOf(g.tipoMaterial as (typeof ORDEM_MATERIAL)[number]);
}

/** Remetido: uma linha por trilho + tipo de material (o material é uma coluna só na planilha). */
function agruparPorPerfilEMaterial(grupos: Grupo[]): Grupo[][] {
  const chaves = new Map<string, Grupo[]>();
  for (const g of grupos) {
    const chave = `${g.perfil}|${rotuloMaterial(g)}`;
    chaves.set(chave, [...(chaves.get(chave) ?? []), g]);
  }
  return [...chaves.values()].sort(
    (a, b) =>
      numeroDoPerfil(a[0].perfil) - numeroDoPerfil(b[0].perfil) ||
      ordemDoMaterial(a[0]) - ordemDoMaterial(b[0]) ||
      rotuloMaterial(a[0]).localeCompare(rotuloMaterial(b[0])),
  );
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
    'Tipo de remetido',
    'Peças',
    'Metros',
    'Toneladas',
    'Baixa — Reserva',
    'Depósito destino',
    'Considerar real meta',
  ]);

  for (const mov of movimentacoes) {
    const [dia, mes, ano] = diaMesAno(mov.dataMovimentacao);
    const destinoTransportadora = [upper(mov.destino), mov.transportadora ? upper(mov.transportadora) : null]
      .filter(Boolean)
      .join(' / ');
    const tipoRemetido = mov.remetidoDetalhe?.tipoRemetido ?? ''; // VENDA, TRANS ou INDUS — igual à planilha

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
    // Preenchidas à mão na planilha mestra — o app não captura.
    const manuais = ['', '', ''];

    if (mov.grupos.length === 0) {
      // Pré-cadastro ainda aguardando o Pátio confirmar a chegada — sem grupos ainda.
      sheet.addRow([...base, '', '', '', tipoRemetido, null, null, null, ...manuais]);
      continue;
    }

    for (const grupos of agruparPorPerfilEMaterial(mov.grupos)) {
      const marcas = unicos(grupos.filter((g) => g.tipoMaterial === 'NOVO').map((g) => upper(g.fabricante)));

      sheet.addRow([
        ...base,
        descricaoPerfil(grupos[0].perfil),
        rotuloMaterial(grupos[0]),
        marcas.length > 0 ? marcas.join(' / ') : 'N/A',
        tipoRemetido,
        grupos.reduce((acc, g) => acc + pecasDoGrupo(g.medicoes), 0),
        arredondar2(grupos.reduce((acc, g) => acc + Number(g.metrosTotal), 0)),
        // Peso da NF quando informado; senão a estimativa (metros x fator), "a confirmar".
        somaOuNull(
          grupos.map((g) => (g.pesoInformado != null ? Number(g.pesoInformado) : g.pesoCalculado != null ? Number(g.pesoCalculado) : null)),
          arredondar3,
        ),
        ...manuais,
      ]);
    }
  }

  formatarColunasDeData(sheet);
}

/**
 * Times New Roman 10 — a planilha operacional usa essa fonte, e a exportação
 * precisa copiar/colar sem precisar reformatar. Aplicada por último, depois que
 * todas as linhas já existem, para cobrir a aba inteira sem perder o negrito do
 * cabeçalho (aplicarCabecalho já define `bold: true` na linha 1 antes desta função rodar).
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
