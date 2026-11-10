import { nfsEmTexto } from '@/lib/nf';
import ExcelJS from 'exceljs';
import type { MovimentacaoRelatorio } from '@/lib/services/relatorio';
import { pecasDoGrupo, arredondar3 } from '@/lib/domain/regras';
import { normalizarLocal } from '@/lib/domain/local';

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
  if (perfil === 'TOCO') return 'TOCO'; // Diversos (sucata sem medição) — igual à planilha
  return `TRILHOS ${perfil.slice(0, 2)}-${perfil.slice(2)}`;
}

function numeroDoPerfil(perfil: string): number {
  if (perfil === 'TOCO') return Number.MAX_SAFE_INTEGER; // Diversos fica depois dos perfis TR
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

function metrosPorSC(medicoes: Medicao[], sc: 'SC1' | 'SC2' | 'SC3' | 'DIVERSOS' | 'JACARE'): number | null {
  // Jacaré é sempre sucata 3: entra na coluna SC-3 junto com as medidas SC3.
  const criterio = (c: string | null) => (sc === 'SC3' ? c === 'SC3' || c === 'JACARE' : c === sc);
  const soma = medicoes.filter((m) => criterio(m.classificacaoSC)).reduce((acc, m) => acc + Number(m.metros), 0);
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

/**
 * Proteção contra injeção de fórmula: texto que começa com = + @ ou - (ou tab/CR) vira fórmula no Excel.
 * Um apóstrofo na frente faz a célula ficar como texto. O traço isolado ("-") é marcador da planilha e fica como está.
 */
/** Colunas numéricas em branco viram 0: a planilha precisa mostrar todos os totais, mesmo sem movimento. */
function zerarNumericas<T>(valores: (T | null)[], aPartirDe: number): (T | number)[] {
  return valores.map((v, i) => (i >= aPartirDe && v == null ? 0 : (v as T)));
}

function sanear<T>(valores: T[]): T[] {
  return valores.map((v) =>
    typeof v === 'string' && v !== '-' && /^[=+@\t\r-]/.test(v) ? (`'${v}` as unknown as T) : v,
  );
}

function aplicarCabecalho(sheet: ExcelJS.Worksheet, colunas: string[]) {
  sheet.addRow(colunas);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 }; // branco, negrito
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D5AA6' } }; // azul escuro
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = 32; // duas linhas: cabeçalhos longos (ex.: "Tipo do documento") quebram e não ficam cortados
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
  // Igual à planilha de referência: faixas de grupo na linha 1 (mescladas em formatarRecebidos) e nomes na linha 2.
  sheet.addRow(FAIXAS_RECEBIDOS);
  sheet.addRow(COLUNAS_RECEBIDOS);

  // Recebidos em ordem crescente de data (dia 1 em cima, último dia embaixo), como a planilha da empresa.
  const cronologico = [...movimentacoes].sort(
    (a, b) => (a.dataMovimentacao?.getTime() ?? 0) - (b.dataMovimentacao?.getTime() ?? 0) || a.createdAt.getTime() - b.createdAt.getTime(),
  );

  for (const mov of cronologico) {
    const [dia, mes, ano] = diaMesAno(mov.dataMovimentacao);
    const primeiraLinha = sheet.rowCount + 1;
    const base = [
      dia,
      mes,
      ano,
      mov.tipoDocumento,
      nfsEmTexto(mov),
      mov.tipoTransporte,
      formatarPlaca(mov),
      '-', // Qtd. de vagões — não capturado pelo app (só Caminhão existe hoje)
      normalizarLocal(mov.origem),
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

      const valores = zerarNumericas([
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
      ], 11);
      const linha = sheet.addRow(sanear(valores));
      const r = linha.number;
      const totalMetros = Number(valores[23]);
      linha.getCell(17).value = { formula: `SUM(N${r}:P${r})`, result: Number(valores[16]) };
      linha.getCell(22).value = { formula: `SUM(R${r}:U${r})`, result: Number(valores[21]) };
      linha.getCell(24).value = { formula: `Q${r}+V${r}+W${r}`, result: totalMetros };
      // Peso (t) = total de metros da linha x fator do perfil (kg/m / 1000), como na planilha da Paula.
      const kgmPerfil = KG_POR_METRO[grupos[0].perfil];
      if (kgmPerfil) {
        linha.getCell(13).value = { formula: `X${r}*${kgmPerfil / 1000}`, result: Number(valores[12]) };
        linha.getCell(13).numFmt = '#,##0.000';
      }
    }
    pintarSePendente(sheet, primeiraLinha, mov.status);
  }

  formatarColunasDeData(sheet);
  adicionarTotaisRecebidos(sheet);
  formatarRecebidos(sheet);
}

/** Movimentação ainda pendente de conferência: a linha inteira fica amarela, para mostrar o que falta. */
function pintarSePendente(sheet: ExcelJS.Worksheet, primeiraLinha: number, status: string) {
  if (status !== 'PENDENTE_CONFERENCIA') return;
  const colunas = sheet.columnCount;
  for (let n = primeiraLinha; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    for (let c = 1; c <= colunas; c++) {
      row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // amarelo
    }
  }
}

const FAIXAS_RECEBIDOS = [
  'DATA', '', '', 'DOCUMENTOS', '', 'TRANSPORTE', '', '', 'DESCRIÇÃO', 'MATERIAL', '', '', '',
  'REEMPREGO', '', '', '', 'SUCATA', '', '', '', '', 'NOVO', 'TOTAL',
];

const COLUNAS_RECEBIDOS = [
  'Dia', 'Mês', 'Ano', 'Tipo do documento', 'Número', 'Tipo de transporte', 'Placa', 'Qtd. de vagões', 'Origem',
  'Descrição do perfil', 'Fabricante', 'Qtd. de peças', 'Peso (Ton.)', 'G1', 'G2', 'G3', 'Total', 'SC-1', 'SC-2 - L', 'SC-3',
  'Em Classificação', 'Total', 'Novo', 'Total',
];

/** kg por metro de cada perfil (peso = metros x kg/m). TR45, TR50 e TR57 são os nominais padrão, a confirmar. */
const KG_POR_METRO: Record<string, number> = { TR45: 45, TR50: 50, TR57: 57, TR60: 60, UIC60: 60, TR68: 68 };

/** Linha de totais no fim da aba (igual à planilha da Paula): SUBTOTAL das colunas, e as somas dos grupos. */
function adicionarTotaisRecebidos(sheet: ExcelJS.Worksheet) {
  const primeira = 3;
  const ultima = sheet.rowCount;
  if (ultima < primeira) return;
  const r = ultima + 1;
  const linha = sheet.addRow([]);
  const letra = (c: number) => sheet.getColumn(c).letter;
  const valorDe = (c: number): number => {
    let total = 0;
    for (let n = primeira; n <= ultima; n++) {
      const v = sheet.getRow(n).getCell(c).value as unknown;
      const numero = typeof v === 'number' ? v : typeof v === 'object' && v !== null && 'result' in v ? Number((v as { result: unknown }).result) : 0;
      total += Number.isFinite(numero) ? numero : 0;
    }
    return total;
  };
  for (const c of [13, 14, 15, 16, 18, 19, 20, 21, 23]) {
    const l = letra(c);
    linha.getCell(c).value = { formula: `SUBTOTAL(9,${l}${primeira}:${l}${ultima})`, result: valorDe(c) };
  }
  const q = valorDe(14) + valorDe(15) + valorDe(16);
  const v = valorDe(18) + valorDe(19) + valorDe(20) + valorDe(21);
  const w = valorDe(23);
  linha.getCell(13).numFmt = '#,##0.000';
  linha.getCell(17).value = { formula: `SUM(N${r}:P${r})`, result: q };
  linha.getCell(22).value = { formula: `R${r}+S${r}+T${r}+U${r}`, result: v };
  linha.getCell(24).value = { formula: `Q${r}+V${r}+W${r}`, result: q + v + w };
  linha.font = { name: 'Calibri', size: 11, bold: true };
  linha.border = { top: { style: 'medium' }, bottom: { style: 'medium' } };
}

/** Faixas mescladas, cores e larguras da planilha de referência (Recebido 2026). */
function formatarRecebidos(sheet: ExcelJS.Worksheet) {
  const faixas: [string, string][] = [['A1', 'C1'], ['D1', 'E1'], ['F1', 'H1'], ['J1', 'M1'], ['N1', 'Q1'], ['R1', 'V1']];
  for (const [de, ate] of faixas) sheet.mergeCells(`${de}:${ate}`);
  const AZUL = 'FF2F5597';
  for (const linha of [1, 2]) {
    const row = sheet.getRow(linha);
    row.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    });
  }
  sheet.getRow(2).height = 36;
  const larguras = [6, 6, 7, 14, 12, 13, 12, 10, 20, 16, 16, 10, 11, 10, 10, 10, 10, 10, 10, 10, 12, 10, 11, 12];
  larguras.forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  // Sucata (V) e Total (X) em vermelho, como na planilha de referência.
  for (let n = 3; n <= sheet.rowCount; n++) {
    for (const col of [17, 22, 24]) {
      const cell = sheet.getRow(n).getCell(col);
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
    }
  }
  sheet.views = [{ state: 'frozen', ySplit: 2 }];
  sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 24 } };
}

const FAIXAS_REMETIDOS = [
  'DATA', '', '', 'DOCUMENTO', '', '', 'TRANSPORTE', '', 'DESCRIÇÃO', '', 'MATERIAL', '', '', 'QUANTIDADE', '', '', 'BAIXA', '', '', '',
];

const COLUNAS_REMETIDOS = [
  'Dia', 'Mês', 'Ano', 'Tipo', 'Num. N.F.', 'Reserva/Pedido', 'Tipo', 'Placa', 'Destino / Transportadora', 'Perfil', 'Tipo',
  'Marca', 'Tipo', 'Peças', 'Metros', 'Ton', 'Reserva', 'Depósito Destino', 'Considerar real meta', 'Obs',
];

/** Faixas mescladas, cores, larguras e painel congelado da aba de remetidos (igual à referência Remetido 2026). */
function formatarRemetidos(sheet: ExcelJS.Worksheet) {
  const faixas: [string, string][] = [['A1', 'C1'], ['D1', 'F1'], ['G1', 'H1'], ['I1', 'J1'], ['K1', 'M1'], ['N1', 'P1'], ['Q1', 'T1']];
  for (const [de, ate] of faixas) sheet.mergeCells(`${de}:${ate}`);
  for (const linha of [1, 2]) {
    const row = sheet.getRow(linha);
    row.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
    });
  }
  sheet.getRow(2).height = 36;
  const larguras = [6, 6, 7, 12, 12, 14, 12, 12, 24, 16, 14, 12, 12, 10, 11, 10, 12, 16, 16, 14];
  larguras.forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  sheet.views = [{ state: 'frozen', ySplit: 2 }];
  sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 20 } };
}

/** Aplica bordas em todas as células da planilha. */
function aplicarBordas(sheet: ExcelJS.Worksheet) {
  // Percorre todas as colunas da aba (inclusive as vazias): sem isso, células sem valor ficam sem contorno.
  const colunas = sheet.columnCount;
  for (let n = 1; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    for (let c = 1; c <= colunas; c++) {
      row.getCell(c).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  }
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
  // Igual à planilha de referência (Remetido 2026): faixas na linha 1 e nomes na linha 2.
  sheet.addRow(FAIXAS_REMETIDOS);
  sheet.addRow(COLUNAS_REMETIDOS);

  // Remetidos em ordem crescente de data, igual aos recebidos (para copiar e colar na planilha da empresa).
  const cronologicoRemetidos = [...movimentacoes].sort(
    (a, b) => (a.dataMovimentacao?.getTime() ?? 0) - (b.dataMovimentacao?.getTime() ?? 0) || a.createdAt.getTime() - b.createdAt.getTime(),
  );

  for (const mov of cronologicoRemetidos) {
    const [dia, mes, ano] = diaMesAno(mov.dataMovimentacao);
    const destinoTransportadora = [normalizarLocal(mov.destino),mov.transportadora ? upper(mov.transportadora) : null]
      .filter(Boolean)
      .join(' / ');
    const tipoRemetido = mov.remetidoDetalhe?.tipoRemetido ?? ''; // VENDA, TRANS ou INDUS — igual à planilha

    const base = [
      dia,
      mes,
      ano,
      mov.tipoDocumento,
      nfsEmTexto(mov),
      upper(mov.reservaPedido),
      mov.tipoTransporte,
      formatarPlaca(mov),
      destinoTransportadora,
    ];
    // Preenchidas à mão na planilha mestra — o app não captura.
    const manuais = ['', '', ''];
    const primeiraLinha = sheet.rowCount + 1;

    if (mov.grupos.length === 0) {
      // Pré-cadastro ainda aguardando o Pátio confirmar a chegada — sem grupos ainda.
      sheet.addRow(sanear([...base, '', '', '', tipoRemetido, null, null, null, ...manuais, '']));
      pintarSePendente(sheet, primeiraLinha, mov.status);
      continue;
    }

    for (const grupos of agruparPorPerfilEMaterial(mov.grupos)) {
      const marcas = unicos(grupos.filter((g) => g.tipoMaterial === 'NOVO').map((g) => upper(g.fabricante)));
      // Diversos (TOCO): sem medição — Peças e Metros ficam "-"; Toneladas só quando o Administrativo
      // já informou o peso da pesagem (senão "-").
      const diversos = grupos[0].perfil === 'TOCO';
      const toneladas = somaOuNull(
        // Peso da NF quando informado; senão a estimativa (metros x fator), "a confirmar".
        grupos.map((g) => (g.pesoInformado != null ? Number(g.pesoInformado) : g.pesoCalculado != null ? Number(g.pesoCalculado) : null)),
        arredondar3,
      );

      const metrosGrupo = arredondar2(grupos.reduce((acc, g) => acc + Number(g.metrosTotal), 0));
      const kgm = KG_POR_METRO[grupos[0].perfil];
      const linha = sheet.addRow(sanear([
        ...base,
        descricaoPerfil(grupos[0].perfil),
        rotuloMaterial(grupos[0]),
        marcas.length > 0 ? marcas.join(' / ') : 'N/A',
        tipoRemetido,
        diversos ? '-' : grupos.reduce((acc, g) => acc + pecasDoGrupo(g.medicoes), 0),
        diversos ? '-' : metrosGrupo,
        diversos ? (toneladas ?? '-') : toneladas,
        ...manuais,
        '',
      ]));
      // Toneladas = metros x kg/m do perfil (igual à referência). Sucata/diversos sem metro ficam como estão.
      if (!diversos && kgm) {
        const r = linha.number;
        linha.getCell(16).value = { formula: `O${r}*${kgm}/1000`, result: Math.round(metrosGrupo * kgm) / 1000 };
      }
    }
    pintarSePendente(sheet, primeiraLinha, mov.status);
  }

  formatarColunasDeData(sheet);
  formatarRemetidos(sheet);
}

/**
 * Calibri 11 — a planilha operacional usa essa fonte. Aplicada por último,
 * depois que todas as linhas já existem, para cobrir a aba inteira sem perder
 * o negrito e cor do cabeçalho (aplicarCabecalho já define isso na linha 1).
 * Também aplica cor vermelha (FF0000) nas colunas "Total" (a coluna de totais).
 */
function aplicarFontePadrao(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row, rowNum) => {
    if (rowNum <= 2) return; // pula cabeçalho (duas linhas)
    row.font = { ...row.font, name: 'Calibri', size: 11 };
    row.height = 18; // altura padronizada
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

  aplicarBordas(recebidos);
  aplicarBordas(remetidos);

  return workbook.xlsx.writeBuffer();
}
