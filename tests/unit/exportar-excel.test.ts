import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { gerarRelatorioExcel } from '@/lib/services/exportarExcel';
import type { MovimentacaoRelatorio } from '@/lib/services/relatorio';

type GrupoTeste = {
  perfil: string;
  tipoMaterial: 'NOVO' | 'REEMPREGO' | 'SUCATA';
  classificacao?: 'G1' | 'G2' | 'G3' | null;
  tampao?: boolean;
  fabricante?: string | null;
  metros: number;
  pecas?: number;
  pesoCalculado?: number | null;
  pesoInformado?: number | null;
  medicoes?: { quantidade: number; metros: number; classificacaoSC?: 'SC1' | 'SC2' | 'SC3' | null }[];
};

function grupo(g: GrupoTeste) {
  return {
    perfil: g.perfil,
    tipoMaterial: g.tipoMaterial,
    classificacao: g.classificacao ?? null,
    tampao: g.tampao ?? false,
    fabricante: g.fabricante ?? null,
    metrosTotal: g.metros,
    pesoCalculado: g.pesoCalculado ?? null,
    pesoInformado: g.pesoInformado ?? null,
    medicoes: g.medicoes ?? [{ quantidade: g.pecas ?? 1, metros: g.metros, classificacaoSC: null }],
  };
}

function movimentacao(tipo: 'RECEBIMENTO' | 'REMETIDO', nf: string, grupos: GrupoTeste[], extra: Record<string, unknown> = {}) {
  return {
    tipo,
    tipoDocumento: 'NF',
    numeroDocumento: nf,
    tipoTransporte: 'CAMINHAO',
    dataMovimentacao: new Date(Date.UTC(2026, 8, 1)), // 01/09/2026
    placaCavalo: 'CAV1A23',
    placaCarreta: 'JDO7C06',
    placaCarreta2: null,
    origem: 'são carlos',
    destino: 'rumo - praia grande',
    transportadora: null,
    reservaPedido: '2100282834',
    remetidoDetalhe: tipo === 'REMETIDO' ? { tipoRemetido: 'TRANS' } : null,
    grupos: grupos.map(grupo),
    ...extra,
  } as unknown as MovimentacaoRelatorio;
}

async function lerAba(movs: MovimentacaoRelatorio[], aba: 'Recebidos' | 'Remetidos') {
  const buffer = await gerarRelatorioExcel(movs);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet(aba)!;
  const linhas = sheet.getRows(2, Math.max(sheet.rowCount - 1, 0)) ?? [];
  return { sheet, linhas };
}

describe('Excel — aba Recebidos: uma linha por trilho dentro de cada nota', () => {
  it('junta reemprego e sucata do MESMO perfil na mesma linha; perfil diferente fica em outra linha', async () => {
    const mov = movimentacao('RECEBIMENTO', '343207-1', [
      { perfil: 'TR60', tipoMaterial: 'NOVO', fabricante: 'Pangang', metros: 100, pecas: 8, pesoCalculado: 6 },
      { perfil: 'TR55', tipoMaterial: 'REEMPREGO', classificacao: 'G1', metros: 12, pecas: 1, pesoCalculado: 0.66 },
      {
        perfil: 'TR55',
        tipoMaterial: 'SUCATA',
        metros: 494.2,
        medicoes: [
          { quantidade: 40, metros: 454.7, classificacaoSC: 'SC1' },
          { quantidade: 3, metros: 33.9, classificacaoSC: 'SC2' },
          { quantidade: 1, metros: 5.6, classificacaoSC: 'SC3' },
        ],
        pesoCalculado: 27.18,
      },
    ]);

    const { linhas } = await lerAba([mov], 'Recebidos');
    expect(linhas).toHaveLength(2);

    // TR-55 vem antes de TR-60 (ordem crescente de perfil)
    const [tr55, tr60] = linhas;
    expect(tr55.getCell(10).value).toBe('TRILHOS TR-55');
    expect(tr55.getCell(11).value).toBe('-'); // sem material NOVO → "-"
    expect(tr55.getCell(12).value).toBe(45); // peças: 1 + 40 + 3 + 1
    expect(tr55.getCell(13).value).toBe(0.66); // peso: só o que não é sucata
    expect(tr55.getCell(14).value).toBe(12); // G1
    expect(tr55.getCell(17).value).toBe(12); // Total reemprego
    expect(tr55.getCell(18).value).toBe(454.7); // SC-1
    expect(tr55.getCell(19).value).toBe(33.9); // SC-2 - L
    expect(tr55.getCell(20).value).toBe(5.6); // SC-3
    expect(tr55.getCell(22).value).toBe(494.2); // Total sucata
    expect(tr55.getCell(23).value).toBeNull(); // Novo
    expect(tr55.getCell(24).value).toBe(506.2); // soma de metros do veículo

    expect(tr60.getCell(10).value).toBe('TRILHOS TR-60');
    expect(tr60.getCell(11).value).toBe('PANGANG');
    expect(tr60.getCell(23).value).toBe(100);
    expect(tr60.getCell(24).value).toBe(100);
  });

  it('dois grupos de reemprego do mesmo perfil (G1 e G2) viram uma linha só, cada um na sua coluna', async () => {
    const mov = movimentacao('RECEBIMENTO', '343208-1', [
      { perfil: 'TR68', tipoMaterial: 'REEMPREGO', classificacao: 'G1', metros: 12, pecas: 1 },
      { perfil: 'TR68', tipoMaterial: 'REEMPREGO', classificacao: 'G2', metros: 24, pecas: 2 },
    ]);

    const { linhas } = await lerAba([mov], 'Recebidos');
    expect(linhas).toHaveLength(1);
    expect(linhas[0].getCell(14).value).toBe(12); // G1
    expect(linhas[0].getCell(15).value).toBe(24); // G2
    expect(linhas[0].getCell(16).value).toBeNull(); // G3
    expect(linhas[0].getCell(17).value).toBe(36); // Total reemprego
    expect(linhas[0].getCell(24).value).toBe(36);
  });

  it('formato como na planilha: placa única, vagões "-", dia/mês com zero à esquerda', async () => {
    const mov = movimentacao('RECEBIMENTO', '343209-1', [{ perfil: 'TR57', tipoMaterial: 'REEMPREGO', classificacao: 'G1', metros: 10 }]);
    const { linhas } = await lerAba([mov], 'Recebidos');

    expect(linhas[0].getCell(7).value).toBe('JDO7C06'); // só a carreta, sem "(cavalo)"
    expect(linhas[0].getCell(8).value).toBe('-'); // Qtd. de vagões
    expect(linhas[0].getCell(9).value).toBe('SÃO CARLOS');
    expect(linhas[0].getCell(1).numFmt).toBe('00'); // Dia: 01
    expect(linhas[0].getCell(2).numFmt).toBe('00'); // Mês: 09
    expect(linhas[0].getCell(1).value).toBe(1);
    expect(linhas[0].getCell(2).value).toBe(9);
  });
});

describe('Excel — aba Remetidos: uma linha por trilho e tipo de material', () => {
  it('usa as colunas da planilha: perfil "TRILHOS TR-xx", material, marca N/A, tipo de remetido', async () => {
    const mov = movimentacao('REMETIDO', '325005-1', [
      { perfil: 'TR57', tipoMaterial: 'REEMPREGO', classificacao: 'G1', tampao: true, metros: 551.34, pecas: 48, pesoCalculado: 31.426 },
    ]);

    const { linhas } = await lerAba([mov], 'Remetidos');
    expect(linhas).toHaveLength(1);
    const l = linhas[0];
    expect(l.getCell(6).value).toBe('2100282834'); // Reserva/Pedido
    expect(l.getCell(8).value).toBe('JDO7C06'); // Placa
    expect(l.getCell(9).value).toBe('RUMO - PRAIA GRANDE'); // Destino
    expect(l.getCell(10).value).toBe('TRILHOS TR-57'); // Perfil
    expect(l.getCell(11).value).toBe('TAMPÃO'); // Tipo de material
    expect(l.getCell(12).value).toBe('N/A'); // Marca
    expect(l.getCell(13).value).toBe('TRANS'); // Tipo de remetido
    expect(l.getCell(14).value).toBe(48); // Peças
    expect(l.getCell(15).value).toBe(551.34); // Metros
    expect(l.getCell(16).value).toBe(31.426); // Toneladas
    expect(l.getCell(17).value).toBe(''); // Baixa — Reserva (manual)
    expect(l.getCell(18).value).toBe(''); // Depósito destino (manual)
    expect(l.getCell(19).value).toBe(''); // Considerar real meta (manual)
  });

  it('mesmo trilho com materiais diferentes fica em linhas separadas; grupos iguais do mesmo trilho viram uma linha só', async () => {
    const mov = movimentacao('REMETIDO', '325095-1', [
      { perfil: 'TR60', tipoMaterial: 'REEMPREGO', classificacao: 'G1', metros: 100, pecas: 10, pesoCalculado: 6 },
      { perfil: 'TR60', tipoMaterial: 'REEMPREGO', classificacao: 'G1', metros: 50, pecas: 5, pesoCalculado: 3 },
      { perfil: 'TR60', tipoMaterial: 'NOVO', fabricante: 'Pangang', metros: 30, pecas: 3, pesoInformado: 1.8 },
      { perfil: 'TR68', tipoMaterial: 'SUCATA', metros: 20, pecas: 2, pesoCalculado: 1.36 },
    ]);

    const { linhas } = await lerAba([mov], 'Remetidos');
    expect(linhas).toHaveLength(3);

    const [novo60, reemprego60, sucata68] = linhas;
    expect(novo60.getCell(11).value).toBe('NOVO');
    expect(novo60.getCell(12).value).toBe('PANGANG');
    expect(novo60.getCell(16).value).toBe(1.8); // peso da NF quando informado

    expect(reemprego60.getCell(10).value).toBe('TRILHOS TR-60');
    expect(reemprego60.getCell(11).value).toBe('REEMPREGO G1');
    expect(reemprego60.getCell(14).value).toBe(15); // 10 + 5
    expect(reemprego60.getCell(15).value).toBe(150); // 100 + 50
    expect(reemprego60.getCell(16).value).toBe(9); // 6 + 3

    expect(sucata68.getCell(10).value).toBe('TRILHOS TR-68');
    expect(sucata68.getCell(11).value).toBe('SUCATA');
  });

  it('pré-cadastro aguardando chegada (sem grupos) gera uma linha com os campos de material em branco', async () => {
    const mov = movimentacao('REMETIDO', '484-1', [], { dataMovimentacao: null });
    const { linhas } = await lerAba([mov], 'Remetidos');
    expect(linhas).toHaveLength(1);
    expect(linhas[0].getCell(10).value).toBe(''); // Perfil
    expect(linhas[0].getCell(13).value).toBe('TRANS'); // Tipo de remetido, já conhecido
    expect(linhas[0].getCell(15).value).toBeNull(); // Metros
  });
});
