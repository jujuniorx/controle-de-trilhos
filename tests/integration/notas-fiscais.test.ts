import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { preCadastroRemetidoSchema } from '@/lib/validation/remetido';
import { criarPreCadastroRemetido } from '@/lib/services/remetido';
import { adicionarNf, removerNfExtra } from '@/lib/services/notasFiscais';
import { buscarMovimentacoesRelatorio } from '@/lib/services/relatorio';
import { filtrosRelatorioSchema } from '@/lib/validation/relatorio';

const MARCADOR = 'TESTE-NFS-EXTRAS';
const ADMIN = { userId: 'admin-teste-nfs', nome: 'Admin Teste NFs' };

async function erroDe(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  return '';
}

describe('Mais de uma NF no mesmo carregamento', () => {
  it('adiciona, impede repetida/inválida, acha no relatório e remove', async () => {
    const mov = await criarPreCadastroRemetido(
      crypto.randomUUID(),
      preCadastroRemetidoSchema.parse({ tipoRemetido: 'VENDA', reservaPedido: `${MARCADOR}-${Date.now()}`, destino: 'Usina Teste', numeroDocumento: '555001' }),
      'Pátio',
    );

    await adicionarNf(mov.id, '555002', ADMIN);
    await adicionarNf(mov.id, ' 555003-1 ', ADMIN);
    let atual = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(atual.numeroDocumento).toBe('555001');
    expect(atual.numerosDocumentoExtras).toEqual(['555002', '555003-1']);

    // repetida (principal ou extra) e inválida são recusadas
    expect(await erroDe(adicionarNf(mov.id, '555001', ADMIN))).toMatch(/já está/);
    expect(await erroDe(adicionarNf(mov.id, '555002', ADMIN))).toMatch(/já está/);
    expect(await erroDe(adicionarNf(mov.id, 'abc', ADMIN))).not.toBe('');

    // o relatório acha o carregamento por qualquer uma das NFs
    for (const nf of ['555001', '555002', '555003-1']) {
      const lista = await buscarMovimentacoesRelatorio(filtrosRelatorioSchema.parse({ numeroDocumento: nf }));
      expect(lista.some((m) => m.id === mov.id)).toBe(true);
    }

    // remover uma extra; a principal não é removível por aqui
    await removerNfExtra(mov.id, '555002', ADMIN);
    expect(await erroDe(removerNfExtra(mov.id, '555001', ADMIN))).not.toBe('');
    atual = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(atual.numerosDocumentoExtras).toEqual(['555003-1']);

    const acoes = (await prisma.historicoAlteracao.findMany({ where: { movimentacaoId: mov.id } })).map((h) => h.acao);
    expect(acoes).toEqual(expect.arrayContaining(['NF_ADICIONADA', 'NF_REMOVIDA']));
  });

  it('sem NF principal, a primeira adicionada vira a principal', async () => {
    const mov = await criarPreCadastroRemetido(
      crypto.randomUUID(),
      preCadastroRemetidoSchema.parse({ tipoRemetido: 'VENDA', reservaPedido: `${MARCADOR}-b-${Date.now()}`, destino: 'Usina Teste' }),
      'Pátio',
    );
    await adicionarNf(mov.id, '777001', ADMIN);
    const atual = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(atual.numeroDocumento).toBe('777001');
    expect(atual.numerosDocumentoExtras).toEqual([]);
  });
});

afterAll(async () => {
  const movs = await prisma.movimentacao.findMany({ where: { reservaPedido: { startsWith: MARCADOR } }, select: { id: true } });
  const ids = movs.map((m) => m.id);
  await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.remetidoDetalhe.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});
