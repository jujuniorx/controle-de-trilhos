import { describe, it, expect, afterAll } from 'vitest';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { criarRecebimentoCaminhao } from '@/lib/services/movimentacao';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';
import { informarPesoSucataReal } from '@/lib/services/conferencia';
import { criarPreCadastroRemetido, confirmarRemetido } from '@/lib/services/remetido';
import { preCadastroRemetidoSchema, confirmacaoRemetidoSchema } from '@/lib/validation/remetido';
import { buscarMovimentacoesRelatorio } from '@/lib/services/relatorio';
import { gerarRelatorioExcel } from '@/lib/services/exportarExcel';

const uuid = () => crypto.randomUUID();
const MARCADOR = 'TESTE-EXPORT-EXCEL';
const ADMIN = { userId: 'admin-teste-export', nome: 'Admin Teste Export' };

function novaNF(): string {
  return String(Math.floor(Math.random() * 900000) + 100000);
}

function linhaComNF(sheet: ExcelJS.Worksheet, nf: string): ExcelJS.Row {
  const linhas = sheet.getRows(2, sheet.rowCount - 1) ?? [];
  const linha = linhas.find((r) => String(r.getCell(2).value) === nf);
  if (!linha) throw new Error(`Linha com NF ${nf} não encontrada na planilha ${sheet.name}`);
  return linha;
}

describe('gerarRelatorioExcel', () => {
  it('gera um .xlsx cujos valores batem com o que foi gravado no banco (Recebido NOVO)', async () => {
    const nf = novaNF();
    await criarRecebimentoCaminhao(
      recebimentoCaminhaoSchema.parse({
        clientId: uuid(),
        dados: {
          data: '2026-10-04',
          numeroDocumento: nf,
          origem: MARCADOR,
          placaCavalo: 'ABC1D23',
          responsavelPatio: 'Teste Export',
        },
        grupos: [
          {
            clientId: uuid(),
            perfil: 'TR22',
            tipoMaterial: 'NOVO',
            marca: 'NIPPON',
            medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 10 }],
          },
        ],
      }),
    );

    const movimentacoes = await buscarMovimentacoesRelatorio({ numeroDocumento: nf });
    const buffer = await gerarRelatorioExcel(movimentacoes);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as Parameters<typeof workbook.xlsx.load>[0]);

    const linha = linhaComNF(workbook.getWorksheet('Recebidos')!, nf);
    expect(linha.getCell(3).value).toBe(MARCADOR); // Origem
    expect(linha.getCell(10).value).toBe('TR22'); // Perfil
    expect(linha.getCell(11).value).toBe('NOVO'); // Material
    expect(linha.getCell(13).value).toBe('Nippon'); // Fabricante
    expect(linha.getCell(15).value).toBe(10); // Metros = 1 x 10m
    expect(linha.getCell(16).value).toBe(0.22); // Peso = 10m x fator TR22 (0.022 t/m)
    expect(linha.getCell(17).value).toBe('');
  });

  it('gera uma única linha combinada para SUCATA de Recebimento, com o peso real da Movimentacao', async () => {
    const nf = novaNF();
    const mov = await criarRecebimentoCaminhao(
      recebimentoCaminhaoSchema.parse({
        clientId: uuid(),
        dados: {
          data: '2026-10-04',
          numeroDocumento: nf,
          origem: MARCADOR,
          placaCavalo: 'ABC1D23',
          responsavelPatio: 'Teste Export',
        },
        grupos: [
          {
            clientId: uuid(),
            perfil: 'TR57',
            tipoMaterial: 'SUCATA',
            medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' }],
          },
        ],
      }),
    );

    const semPeso = await gerarRelatorioExcel(await buscarMovimentacoesRelatorio({ numeroDocumento: nf }));
    const workbookPendente = new ExcelJS.Workbook();
    await workbookPendente.xlsx.load(semPeso as Parameters<typeof workbookPendente.xlsx.load>[0]);
    const linhaPendente = linhaComNF(workbookPendente.getWorksheet('Recebidos')!, nf);
    expect(linhaPendente.getCell(16).value).toBeNull(); // Peso ainda pendente
    expect(linhaPendente.getCell(17).value).toBe('SIM'); // Peso pendente

    await informarPesoSucataReal(mov.id, 3.456, ADMIN);
    const comPeso = await gerarRelatorioExcel(await buscarMovimentacoesRelatorio({ numeroDocumento: nf }));
    const workbookInformado = new ExcelJS.Workbook();
    await workbookInformado.xlsx.load(comPeso as Parameters<typeof workbookInformado.xlsx.load>[0]);
    const linhaInformada = linhaComNF(workbookInformado.getWorksheet('Recebidos')!, nf);
    expect(linhaInformada.getCell(11).value).toBe('SUCATA');
    expect(linhaInformada.getCell(14).value).toBe('SC1'); // Classificação SC
    expect(linhaInformada.getCell(15).value).toBe(8.1); // Metros
    expect(linhaInformada.getCell(16).value).toBe(3.456); // Peso real informado
    expect(linhaInformada.getCell(17).value).toBe('');
  });

  it('gera uma linha por grupo para Remetido, incluindo SUCATA com pesoInformado próprio', async () => {
    const nf = novaNF();
    const preCadastro = await criarPreCadastroRemetido(
      uuid(),
      preCadastroRemetidoSchema.parse({ tipoRemetido: 'VENDA', reservaPedido: `${MARCADOR}-R`, destino: MARCADOR }),
    );
    await confirmarRemetido(
      preCadastro.id,
      confirmacaoRemetidoSchema.parse({
        dados: { data: '2026-10-04', numeroDocumento: nf, placaCavalo: 'ABC1D23', responsavelPatio: 'Teste Export' },
        grupos: [
          {
            clientId: uuid(),
            perfil: 'TR68',
            tipoMaterial: 'SUCATA',
            pesoInformado: 2.4,
            medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC2' }],
          },
        ],
      }),
    );

    const movimentacoes = await buscarMovimentacoesRelatorio({ numeroDocumento: nf });
    const buffer = await gerarRelatorioExcel(movimentacoes);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as Parameters<typeof workbook.xlsx.load>[0]);

    const linha = linhaComNF(workbook.getWorksheet('Remetidos')!, nf);
    expect(linha.getCell(3).value).toBe('Venda'); // Tipo remetido
    expect(linha.getCell(4).value).toBe(`${MARCADOR}-R`); // Reserva/Pedido
    expect(linha.getCell(5).value).toBe(MARCADOR); // Destino
    expect(linha.getCell(11).value).toBe('TR68'); // Perfil
    expect(linha.getCell(12).value).toBe('SUCATA'); // Material
    expect(linha.getCell(16).value).toBe('SC2'); // Classificação SC
    expect(linha.getCell(17).value).toBe(8.1); // Metros
    expect(linha.getCell(18).value).toBe(2.4); // Peso informado — exatamente o da NF, nunca recalculado
  });
});

afterAll(async () => {
  const movimentacoes = await prisma.movimentacao.findMany({
    where: { OR: [{ origem: MARCADOR }, { destino: MARCADOR }] },
    select: { id: true },
  });
  const ids = movimentacoes.map((m) => m.id);
  await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: { in: ids } } } });
  await prisma.grupo.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.remetidoDetalhe.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});
