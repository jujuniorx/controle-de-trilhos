import { describe, it, expect, afterAll } from 'vitest';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { criarRecebimentoCaminhao } from '@/lib/services/movimentacao';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';
import { criarPreCadastroRemetido, confirmarRemetido, criarRemetidoDireto } from '@/lib/services/remetido';
import { preCadastroRemetidoSchema, confirmacaoRemetidoSchema, lancamentoDiretoRemetidoSchema } from '@/lib/validation/remetido';
import { buscarMovimentacoesRelatorio } from '@/lib/services/relatorio';
import { gerarRelatorioExcel } from '@/lib/services/exportarExcel';

const uuid = () => crypto.randomUUID();
const MARCADOR = 'teste-export-excel';
const MARCADOR_UPPER = MARCADOR.toUpperCase();

function novaNF(): string {
  return String(Math.floor(Math.random() * 900000) + 100000);
}

async function gerarWorkbook(nf: string): Promise<ExcelJS.Workbook> {
  const movimentacoes = await buscarMovimentacoesRelatorio({ numeroDocumento: nf });
  const buffer = await gerarRelatorioExcel(movimentacoes);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
}

function linhasComNF(sheet: ExcelJS.Worksheet, nf: string): ExcelJS.Row[] {
  const linhas = sheet.getRows(2, sheet.rowCount - 1) ?? [];
  return linhas.filter((r) => String(r.getCell(5).value) === nf);
}

describe('gerarRelatorioExcel — aba Recebidos', () => {
  it('uma linha por grupo: NOVO preenche Fabricante/Peso/coluna Novo, deixa G1-G3/SC em branco', async () => {
    const nf = novaNF();
    await criarRecebimentoCaminhao(
      recebimentoCaminhaoSchema.parse({
        clientId: uuid(),
        dados: {
          data: '2026-10-04',
          numeroDocumento: nf,
          origem: MARCADOR,
          placaCavalo: 'ABC1D23',
          placaCarreta: 'XYZ9E88',
          responsavelPatio: 'Teste Export',
        },
        grupos: [
          {
            clientId: uuid(),
            perfil: 'TR22',
            tipoMaterial: 'NOVO',
            marca: 'NIPPON',
            medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 2, comprimento: 5 }],
          },
        ],
      }),
    );

    const workbook = await gerarWorkbook(nf);
    const sheet = workbook.getWorksheet('Recebidos')!;
    const [linha] = linhasComNF(sheet, nf);

    expect(linha.getCell(1).value).toBe(4); // Dia (2026-10-04)
    expect(linha.getCell(2).value).toBe(10); // Mês
    expect(linha.getCell(3).value).toBe(2026); // Ano
    expect(linha.getCell(4).value).toBe('NF'); // Tipo do documento
    expect(linha.getCell(7).value).toBe('XYZ9E88 (ABC1D23)'); // Placa: carreta prioritária + cavalo
    expect(linha.getCell(8).value).toBe(''); // Qtd. de vagões — nunca capturado
    expect(linha.getCell(9).value).toBe(MARCADOR_UPPER); // Origem maiúsculo
    expect(linha.getCell(10).value).toBe('TRILHOS TR-22'); // Descrição do perfil
    expect(linha.getCell(11).value).toBe('Nippon'); // Fabricante cadastrado — não maiúsculiza
    expect(linha.getCell(12).value).toBe(2); // Qtd. de peças
    expect(linha.getCell(13).value).toBe(0.22); // Peso (Ton.) = 10m x 0.022
    expect(linha.getCell(14).value).toBeNull(); // G1
    expect(linha.getCell(15).value).toBeNull(); // G2
    expect(linha.getCell(16).value).toBeNull(); // G3
    expect(linha.getCell(17).value).toBeNull(); // Total (reemprego)
    expect(linha.getCell(18).value).toBeNull(); // SC-1
    expect(linha.getCell(19).value).toBeNull(); // SC-2 - L
    expect(linha.getCell(20).value).toBeNull(); // SC-3
    expect(linha.getCell(21).value).toBeNull(); // Em Classificação — sempre vazia
    expect(linha.getCell(22).value).toBeNull(); // Total (sucata)
    expect(linha.getCell(23).value).toBe(10); // Novo = metros
    expect(linha.getCell(24).value).toBe(10); // Total = soma de metros
  });

  it('marca "Outros" (texto livre) sai maiúscula no Excel — nunca no banco', async () => {
    const nf = novaNF();
    await criarRecebimentoCaminhao(
      recebimentoCaminhaoSchema.parse({
        clientId: uuid(),
        dados: { data: '2026-10-04', numeroDocumento: nf, origem: MARCADOR, placaCavalo: 'ABC1D23', responsavelPatio: 'Teste Export' },
        grupos: [
          {
            clientId: uuid(),
            perfil: 'TR22',
            tipoMaterial: 'NOVO',
            marca: 'OUTROS',
            fabricanteOutro: 'arcelormittal',
            medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 10 }],
          },
        ],
      }),
    );

    const workbook = await gerarWorkbook(nf);
    const [linha] = linhasComNF(workbook.getWorksheet('Recebidos')!, nf);
    expect(linha.getCell(11).value).toBe('ARCELORMITTAL');
  });

  it('REEMPREGO: metros vão para a coluna G correspondente à classificação do grupo e para o Total', async () => {
    const nf = novaNF();
    await criarRecebimentoCaminhao(
      recebimentoCaminhaoSchema.parse({
        clientId: uuid(),
        dados: { data: '2026-10-04', numeroDocumento: nf, origem: MARCADOR, placaCavalo: 'ABC1D23', responsavelPatio: 'Teste Export' },
        grupos: [
          {
            clientId: uuid(),
            perfil: 'TR68',
            tipoMaterial: 'REEMPREGO',
            classificacao: 'G2',
            medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 12 }],
          },
        ],
      }),
    );

    const workbook = await gerarWorkbook(nf);
    const [linha] = linhasComNF(workbook.getWorksheet('Recebidos')!, nf);
    expect(linha.getCell(14).value).toBeNull(); // G1
    expect(linha.getCell(15).value).toBe(12); // G2
    expect(linha.getCell(16).value).toBeNull(); // G3
    expect(linha.getCell(17).value).toBe(12); // Total (reemprego)
    expect(linha.getCell(23).value).toBeNull(); // Novo
    expect(linha.getCell(24).value).toBe(12); // Total (soma de metros)
  });

  it('SUCATA com medições de classificações SC diferentes no mesmo grupo: metros somam na coluna de cada classificação', async () => {
    const nf = novaNF();
    await criarRecebimentoCaminhao(
      recebimentoCaminhaoSchema.parse({
        clientId: uuid(),
        dados: { data: '2026-10-04', numeroDocumento: nf, origem: MARCADOR, placaCavalo: 'ABC1D23', responsavelPatio: 'Teste Export' },
        grupos: [
          {
            clientId: uuid(),
            perfil: 'TR57',
            tipoMaterial: 'SUCATA',
            medicoes: [
              { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' },
              { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 2.5, classificacaoSC: 'SC3' },
            ],
          },
        ],
      }),
    );

    const workbook = await gerarWorkbook(nf);
    const [linha] = linhasComNF(workbook.getWorksheet('Recebidos')!, nf);
    expect(linha.getCell(13).value).toBeNull(); // Peso (Ton.) — sucata não entra aqui
    expect(linha.getCell(18).value).toBe(8.1); // SC-1
    expect(linha.getCell(19).value).toBeNull(); // SC-2 - L (sem medição dessa classificação)
    expect(linha.getCell(20).value).toBe(2.5); // SC-3
    expect(linha.getCell(21).value).toBeNull(); // Em Classificação
    expect(linha.getCell(22).value).toBe(10.6); // Total (sucata) = 8.1 + 2.5
    expect(linha.getCell(24).value).toBe(10.6); // Total (soma de metros)
  });

  it('placa: só cavalo (sem carreta) aparece sozinho', async () => {
    const nf = novaNF();
    await criarRecebimentoCaminhao(
      recebimentoCaminhaoSchema.parse({
        clientId: uuid(),
        dados: { data: '2026-10-04', numeroDocumento: nf, origem: MARCADOR, placaCavalo: 'CMG1234', responsavelPatio: 'Teste Export' },
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

    const workbook = await gerarWorkbook(nf);
    const [linha] = linhasComNF(workbook.getWorksheet('Recebidos')!, nf);
    expect(linha.getCell(7).value).toBe('CMG1234'); // Placa antiga, só cavalo
  });
});

describe('gerarRelatorioExcel — aba Remetidos', () => {
  it('uma linha por grupo, Destino/Transportadora e Reserva/Pedido maiúsculos, Toneladas = peso informado da NF', async () => {
    const nf = novaNF();
    const preCadastro = await criarPreCadastroRemetido(
      uuid(),
      preCadastroRemetidoSchema.parse({ tipoRemetido: 'VENDA', reservaPedido: `${MARCADOR}-r`, destino: MARCADOR }),
    );
    await confirmarRemetido(
      preCadastro.id,
      confirmacaoRemetidoSchema.parse({
        dados: {
          data: '2026-10-04',
          numeroDocumento: nf,
          placaCavalo: 'ABC1D23',
          transportadora: 'transportes rapido',
          responsavelPatio: 'Teste Export',
        },
        grupos: [
          {
            clientId: uuid(),
            perfil: 'TR68',
            tipoMaterial: 'SUCATA',
            pesoInformado: 2.4,
            medicoes: [
              { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC2' },
              { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 1.5, classificacaoSC: 'SC3' },
            ],
          },
        ],
      }),
    );

    const workbook = await gerarWorkbook(nf);
    const sheet = workbook.getWorksheet('Remetidos')!;
    const [linha] = linhasComNF(sheet, nf);

    expect(linha.getCell(1).value).toBe(4); // Dia
    expect(linha.getCell(2).value).toBe(10); // Mês
    expect(linha.getCell(3).value).toBe(2026); // Ano
    expect(linha.getCell(6).value).toBe(`${MARCADOR}-r`.toUpperCase()); // Reserva/Pedido maiúsculo
    expect(linha.getCell(8).value).toBe('ABC1D23'); // Placa (só cavalo)
    expect(linha.getCell(9).value).toBe(`${MARCADOR_UPPER} / TRANSPORTES RAPIDO`); // Destino/Transportadora
    expect(linha.getCell(10).value).toBe('TR68'); // Perfil
    expect(linha.getCell(11).value).toBe('SUCATA'); // Tipo de material
    expect(linha.getCell(12).value).toBe(''); // Marca — só NOVO
    expect(linha.getCell(13).value).toBe('SC-2 - L, SC-3'); // Tipo/identificação (classificações mistas)
    expect(linha.getCell(14).value).toBe(2); // Peças
    expect(linha.getCell(15).value).toBe(9.6); // Metros = 8.1 + 1.5
    expect(linha.getCell(16).value).toBe(2.4); // Toneladas = peso informado — nunca recalculado
  });

  it('NOVO: Marca aparece (cadastrada não maiúscula), Tipo/identificação vazio; peso sem informar usa a estimativa', async () => {
    const nf = novaNF();
    await criarRemetidoDireto(
      uuid(),
      lancamentoDiretoRemetidoSchema.parse({
        reservaPedido: `${MARCADOR}-direto`,
        destino: MARCADOR,
        dados: { data: '2026-10-04', numeroDocumento: nf, placaCavalo: 'ABC1D23', responsavelPatio: 'Teste Export' },
        grupos: [
          {
            clientId: uuid(),
            perfil: 'TR22',
            tipoMaterial: 'NOVO',
            marca: 'EVRAZ',
            medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 10 }],
          },
        ],
      }),
    );

    const workbook = await gerarWorkbook(nf);
    const [linha] = linhasComNF(workbook.getWorksheet('Remetidos')!, nf);
    expect(linha.getCell(12).value).toBe('Evraz'); // Marca cadastrada
    expect(linha.getCell(13).value).toBe(''); // Tipo/identificação — não se aplica a NOVO
    expect(linha.getCell(16).value).toBe(0.22); // Toneladas = estimativa (10m x 0.022), "a confirmar"
  });

  it('pré-cadastro aguardando chegada (sem grupos ainda) gera uma linha com os campos de grupo em branco', async () => {
    const nf = novaNF();
    await criarPreCadastroRemetido(
      uuid(),
      preCadastroRemetidoSchema.parse({ tipoRemetido: 'TRANS', reservaPedido: `${MARCADOR}-pre`, destino: MARCADOR, numeroDocumento: nf }),
    );

    const movimentacoes = await buscarMovimentacoesRelatorio({ numeroDocumento: nf });
    const buffer = await gerarRelatorioExcel(movimentacoes);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as Parameters<typeof workbook.xlsx.load>[0]);
    const [linha] = linhasComNF(workbook.getWorksheet('Remetidos')!, nf);

    expect(linha.getCell(10).value).toBe(''); // Perfil
    expect(linha.getCell(15).value).toBeNull(); // Metros
    expect(linha.getCell(16).value).toBeNull(); // Toneladas
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
