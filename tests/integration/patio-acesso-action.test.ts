import { describe, it, expect, vi, afterAll } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}));

import { prisma } from '@/lib/db';
import { criarRecebimento } from '@/app/patio/(protegido)/recebimentos/novo/actions';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';

const uuid = () => crypto.randomUUID();
const RESPONSAVEL = 'Teste Seguranca Patio';

function dadosBase() {
  return {
    data: '2026-09-20',
    numeroDocumento: String(Math.floor(Math.random() * 900000) + 100000),
    origem: 'Rondonópolis',
    placaCavalo: 'ABC1D23',
    placaCarreta: 'XYZ9E88',
    responsavelPatio: RESPONSAVEL,
  };
}

describe('criarRecebimento — reverificação de acesso do Pátio no servidor', () => {
  it('não cria Movimentacao e redireciona quando chamado sem cookie acesso_patio válido (bypass do middleware)', async () => {
    const clientId = uuid();
    const input = recebimentoCaminhaoSchema.parse({
      clientId,
      dados: dadosBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 5 }],
        },
      ],
    });

    let erroCapturado: unknown;
    try {
      await criarRecebimento(input);
    } catch (erro) {
      erroCapturado = erro;
    }

    expect(erroCapturado).toBeDefined();
    expect((erroCapturado as { digest?: string })?.digest).toMatch(/^NEXT_REDIRECT/);

    const total = await prisma.movimentacao.count({ where: { clientId } });
    expect(total).toBe(0);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
