import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { preCadastroRemetidoSchema } from '@/lib/validation/remetido';
import { criarPreCadastroRemetido } from '@/lib/services/remetido';
import { excluirMovimentacao } from '@/lib/services/excluirMovimentacao';
import { listarLixeira, restaurarMovimentacao } from '@/lib/services/lixeira';

const MARCADOR = 'TESTE-INTEGRACAO-EXCLUIR';
const ATOR = { userId: 'teste', nome: 'Teste Integração' };

afterAll(async () => {
  const ids = (await prisma.movimentacao.findMany({ where: { destino: MARCADOR }, select: { id: true } })).map((m) => m.id);
  await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.remetidoDetalhe.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
  await prisma.movimentacaoExcluida.deleteMany({ where: { rotulo: { contains: MARCADOR } } });
});

describe('excluirMovimentacao + lixeira', () => {
  it('apaga a movimentação com o histórico e o detalhe de remetido', async () => {
    const mov = await criarPreCadastroRemetido(
      crypto.randomUUID(),
      preCadastroRemetidoSchema.parse({ tipoRemetido: 'VENDA', destino: MARCADOR }),
    );
    expect(await prisma.historicoAlteracao.count({ where: { movimentacaoId: mov.id } })).toBeGreaterThan(0);

    await excluirMovimentacao(mov.id, ATOR);

    expect(await prisma.movimentacao.findUnique({ where: { id: mov.id } })).toBeNull();
    expect(await prisma.historicoAlteracao.count({ where: { movimentacaoId: mov.id } })).toBe(0);
    expect(await prisma.remetidoDetalhe.count({ where: { movimentacaoId: mov.id } })).toBe(0);
  });

  it('o que foi excluído vai para a lixeira e volta inteiro ao restaurar', async () => {
    const mov = await criarPreCadastroRemetido(
      crypto.randomUUID(),
      preCadastroRemetidoSchema.parse({ tipoRemetido: 'VENDA', destino: MARCADOR }),
    );
    await excluirMovimentacao(mov.id, ATOR);

    const item = (await listarLixeira()).find((i) => i.rotulo.includes(MARCADOR));
    expect(item).toBeDefined();

    const r = await restaurarMovimentacao(item!.id, ATOR);
    expect(r.movimentacaoId).toBe(mov.id);

    const volta = await prisma.movimentacao.findUnique({
      where: { id: mov.id },
      include: { remetidoDetalhe: true, historico: true },
    });
    expect(volta?.destino).toBe(MARCADOR);
    expect(volta?.remetidoDetalhe?.tipoRemetido).toBe('VENDA');
    expect(volta?.historico.some((h) => h.acao === 'RESTAURADO')).toBe(true);
    expect((await listarLixeira()).some((i) => i.id === item!.id)).toBe(false);
    // Restaurar duas vezes não é possível.
    await expect(restaurarMovimentacao(item!.id, ATOR)).rejects.toThrow(/não está mais na lixeira/);
  });

  it('recusa id que não existe', async () => {
    await expect(excluirMovimentacao('id-inexistente', ATOR)).rejects.toThrow(/não encontrada/);
  });
});
