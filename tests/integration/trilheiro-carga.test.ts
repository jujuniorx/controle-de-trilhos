import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { listarCargasDoBo, salvarCargasDoBo } from '@/lib/services/usina';
import { montarEstoqueTrilhos } from '@/lib/services/estoqueTrilhos';
import { chavePosicao, type Posicao } from '@/lib/estoque/trilhos';

const BO = '2026-11-27';
const TLS_TR68_PANGANG: Posicao = { secao: 'NOVO', perfil: 'TR68', tipo: 'TLS', fabricante: 'PANGANG', classe: 'NORMAL' };

async function tls(p: Posicao): Promise<number> {
  const e = await montarEstoqueTrilhos();
  return e.saldos.find((s) => chavePosicao(s) === chavePosicao(p))?.unidades ?? 0;
}

afterAll(async () => {
  await prisma.trilheiroCarga.deleteMany({ where: { trilheiro: 'E46', boEm: new Date(`${BO}T00:00:00Z`) } });
});

describe('TLS carregados no B.O. do trilheiro', () => {
  it('salva por perfil e fabricante, substitui ao salvar de novo e desconta do estoque', async () => {
    const antes = await tls(TLS_TR68_PANGANG);
    await salvarCargasDoBo('E46', BO, [
      { perfil: 'TR68', reemprego: false, fabricante: 'PANGANG', quantidade: 32 },
      { perfil: 'TR68', reemprego: false, fabricante: 'NIPPON', quantidade: 8 },
    ]);
    expect((await listarCargasDoBo('E46', BO)).map((c) => [c.fabricante, c.quantidade])).toEqual([
      ['PANGANG', 32],
      ['NIPPON', 8],
    ]);

    await salvarCargasDoBo('E46', BO, [{ perfil: 'TR68', reemprego: false, fabricante: 'PANGANG', quantidade: 40 }]);
    const depois = await listarCargasDoBo('E46', BO);
    expect(depois).toHaveLength(1);
    expect(await tls(TLS_TR68_PANGANG)).toBe(antes - 40);
  });
});
