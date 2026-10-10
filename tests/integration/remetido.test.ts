import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { preCadastroRemetidoSchema, confirmacaoRemetidoSchema, lancamentoDiretoRemetidoSchema } from '@/lib/validation/remetido';
import {
  criarPreCadastroRemetido,
  confirmarRemetido,
  informarNumeroDocumentoRemetido,
  criarRemetidoDireto,
  atualizarRemetido,
} from '@/lib/services/remetido';
import { conferirRecebimento } from '@/lib/services/conferencia';
import { criarRecebimentoCaminhao } from '@/lib/services/movimentacao';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';

const uuid = () => crypto.randomUUID();
const RESERVA_MARCADOR = 'TESTE-INTEGRACAO-REMETIDO';
const ADMIN = { userId: 'admin-teste-remetido', nome: 'Admin Teste Remetido' };

function preCadastroBase(overrides: Record<string, unknown> = {}) {
  return preCadastroRemetidoSchema.parse({
    tipoRemetido: 'VENDA',
    reservaPedido: `${RESERVA_MARCADOR}-${Math.floor(Math.random() * 1_000_000)}`,
    destino: 'Usina Rondonópolis',
    ...overrides,
  });
}

async function criarPreCadastro(overrides: Record<string, unknown> = {}) {
  return criarPreCadastroRemetido(uuid(), preCadastroBase(overrides));
}

/** Um Recebimento marcado, usado só para testar que as funções de Remetido rejeitam ids de outro tipo. */
async function criarRecebimentoMarcado() {
  return criarRecebimentoCaminhao(
    recebimentoCaminhaoSchema.parse({
      clientId: uuid(),
      dados: {
        data: '2026-10-04',
        numeroDocumento: String(Math.floor(Math.random() * 900000) + 100000),
        origem: RESERVA_MARCADOR,
        placaCavalo: 'ABC1D23',
        responsavelPatio: 'Teste Integração Remetido',
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
}

function dadosConfirmacaoBase() {
  return {
    data: '2026-10-04',
    numeroDocumento: String(Math.floor(Math.random() * 900000) + 100000),
    placaCavalo: 'ABC1D23',
    placaCarreta: 'XYZ9E88',
    responsavelPatio: 'Rafael Bley',
  };
}

describe('criarPreCadastroRemetido', () => {
  it('cria o pré-cadastro com status AGUARDANDO_CHEGADA, sem grupos nem medições', async () => {
    const mov = await criarPreCadastro();
    expect(mov.status).toBe('AGUARDANDO_CHEGADA');
    expect(mov.tipo).toBe('REMETIDO');
    expect(mov.numeroDocumento).toBeNull();
    expect(mov.dataMovimentacao).toBeNull();
    expect(mov.responsavelPatio).toBeNull();
    expect(mov.grupos).toHaveLength(0);
    expect(mov.remetidoDetalhe?.tipoRemetido).toBe('VENDA');
  });

  it('não é contabilizado por listarPendentesConferencia (que é só PENDENTE_CONFERENCIA)', async () => {
    const mov = await criarPreCadastro();
    const pendentes = await prisma.movimentacao.findMany({ where: { status: 'PENDENTE_CONFERENCIA', id: mov.id } });
    expect(pendentes).toHaveLength(0);
  });

  it('é idempotente por clientId: reenviar o mesmo pré-cadastro (fila offline) não duplica', async () => {
    const clientId = uuid();
    const dados = preCadastroBase();
    const primeiro = await criarPreCadastroRemetido(clientId, dados, 'Pátio');
    const segundo = await criarPreCadastroRemetido(clientId, dados, 'Pátio');
    expect(segundo.id).toBe(primeiro.id);
    expect(await prisma.movimentacao.count({ where: { clientId } })).toBe(1);
  });

  it('registra no histórico quem fez o pré-cadastro', async () => {
    const mov = await criarPreCadastroRemetido(uuid(), preCadastroBase(), 'Pátio');
    const historico = await prisma.historicoAlteracao.findFirstOrThrow({ where: { movimentacaoId: mov.id } });
    expect(historico.usuarioNome).toBe('Pátio');
    expect(historico.acao).toBe('PRE_CADASTRO');
  });

  it('aceita NF já conhecida no pré-cadastro', async () => {
    const mov = await criarPreCadastro({ numeroDocumento: '555666' });
    expect(mov.numeroDocumento).toBe('555666');
  });
});

describe('confirmarRemetido', () => {
  it('move o status de AGUARDANDO_CHEGADA para PENDENTE_CONFERENCIA e grava os grupos', async () => {
    const preCadastro = await criarPreCadastro();
    const input = confirmacaoRemetidoSchema.parse({
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          pesoInformado: 12.5,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
    });

    const confirmado = await confirmarRemetido(preCadastro.id, input);
    expect(confirmado.status).toBe('PENDENTE_CONFERENCIA');
    expect(confirmado.grupos).toHaveLength(1);
    expect(Number(confirmado.grupos[0].pesoInformado)).toBe(12.5);
    expect(confirmado.grupos[0].pesoCalculado).toBeNull();
  });

  it('nunca recalcula o peso por metros × fator — persiste exatamente o pesoInformado', async () => {
    const preCadastro = await criarPreCadastro();
    const input = confirmacaoRemetidoSchema.parse({
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR68',
          tipoMaterial: 'REEMPREGO',
          classificacao: 'G2',
          pesoInformado: 7.777,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 12 }],
        },
      ],
    });

    const confirmado = await confirmarRemetido(preCadastro.id, input);
    expect(Number(confirmado.grupos[0].pesoInformado)).toBe(7.777);
  });

  it('persiste grupo de tampão (REEMPREGO + tampao=true) com classificação G1', async () => {
    const preCadastro = await criarPreCadastro();
    const input = confirmacaoRemetidoSchema.parse({
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR57',
          tipoMaterial: 'REEMPREGO',
          classificacao: 'G1',
          tampao: true,
          pesoInformado: 3.2,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 7.5 }],
        },
      ],
    });

    const confirmado = await confirmarRemetido(preCadastro.id, input);
    expect(confirmado.grupos[0].tampao).toBe(true);
    expect(confirmado.grupos[0].classificacao).toBe('G1');
  });

  it('confirma só com placaCavalo (sem placaCarreta)', async () => {
    const preCadastro = await criarPreCadastro();
    const dados = { ...dadosConfirmacaoBase(), placaCarreta: undefined };
    const input = confirmacaoRemetidoSchema.parse({
      dados,
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          pesoInformado: 5,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
    });

    const confirmado = await confirmarRemetido(preCadastro.id, input);
    expect(confirmado.placaCavalo).toBe('ABC1D23');
    expect(confirmado.placaCarreta).toBeNull();
  });

  it('rejeita confirmar um remetido que já não está mais AGUARDANDO_CHEGADA', async () => {
    const preCadastro = await criarPreCadastro();
    const input = confirmacaoRemetidoSchema.parse({
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          pesoInformado: 5,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
    });

    await confirmarRemetido(preCadastro.id, input);
    await expect(confirmarRemetido(preCadastro.id, input)).rejects.toThrow(/aguardando chegada/i);
  });

  it('rejeita confirmar passando o id de um Recebimento (endurecimento contra confusão de tipo)', async () => {
    const recebimento = await criarRecebimentoMarcado();
    const input = confirmacaoRemetidoSchema.parse({
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          pesoInformado: 5,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
    });

    await expect(confirmarRemetido(recebimento.id, input)).rejects.toThrow(/não encontrado/i);
  });

  it('persiste grupo SUCATA com pesoInformado e classificacaoSC por medição', async () => {
    const preCadastro = await criarPreCadastro();
    const input = confirmacaoRemetidoSchema.parse({
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR57',
          tipoMaterial: 'SUCATA',
          pesoInformado: 2.4,
          medicoes: [
            { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' },
            { clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 2.5, classificacaoSC: 'SC3' },
          ],
        },
      ],
    });

    const confirmado = await confirmarRemetido(preCadastro.id, input);
    const grupo = confirmado.grupos[0];
    expect(grupo.tipoMaterial).toBe('SUCATA');
    expect(Number(grupo.pesoInformado)).toBe(2.4);
    expect(grupo.pesoCalculado).toBeNull();
    expect(grupo.medicoes.map((m) => m.classificacaoSC).sort()).toEqual(['SC1', 'SC3']);
  });

  it('confere um remetido com grupo SUCATA sem exigir pesoSucataReal (o peso já vem da NF via pesoInformado)', async () => {
    const preCadastro = await criarPreCadastro();
    const input = confirmacaoRemetidoSchema.parse({
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR57',
          tipoMaterial: 'SUCATA',
          pesoInformado: 2.4,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' }],
        },
      ],
    });

    const confirmado = await confirmarRemetido(preCadastro.id, input);
    await conferirRecebimento(confirmado.id, ADMIN);

    const conferido = await prisma.movimentacao.findUniqueOrThrow({ where: { id: confirmado.id } });
    expect(conferido.status).toBe('CONFERIDO');
    expect(conferido.pesoSucataReal).toBeNull();
  });
});

describe('criarRemetidoDireto', () => {
  function lancamentoDiretoBase(overrides: Record<string, unknown> = {}) {
    return lancamentoDiretoRemetidoSchema.parse({
      tipoRemetido: 'VENDA',
      reservaPedido: `${RESERVA_MARCADOR}-${Math.floor(Math.random() * 1_000_000)}`,
      destino: 'Usina Rondonópolis',
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          pesoInformado: 9.4,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
      ...overrides,
    });
  }

  it('cria a Movimentacao já em PENDENTE_CONFERENCIA, pulando AGUARDANDO_CHEGADA', async () => {
    const mov = await criarRemetidoDireto(uuid(), lancamentoDiretoBase());
    expect(mov.status).toBe('PENDENTE_CONFERENCIA');
    expect(mov.tipo).toBe('REMETIDO');
    expect(mov.grupos).toHaveLength(1);
    expect(Number(mov.grupos[0].pesoInformado)).toBe(9.4);
    expect(mov.grupos[0].pesoCalculado).toBeNull();
  });

  it('persiste tipoRemetido, reservaPedido e destino preenchidos pelo próprio Pátio', async () => {
    const reservaPedido = `${RESERVA_MARCADOR}-${Math.floor(Math.random() * 1_000_000)}`;
    const mov = await criarRemetidoDireto(
      uuid(),
      lancamentoDiretoBase({ tipoRemetido: 'INDUS', reservaPedido, destino: 'Pátio de Sucata' }),
    );
    expect(mov.remetidoDetalhe?.tipoRemetido).toBe('INDUS');
    expect(mov.reservaPedido).toBe(reservaPedido);
    expect(mov.destino).toBe('Pátio de Sucata');
  });

  it('aceita NF ainda não conhecida (numeroDocumento ausente) e permite completá-la depois', async () => {
    const dados = { ...dadosConfirmacaoBase(), numeroDocumento: undefined };
    const mov = await criarRemetidoDireto(uuid(), lancamentoDiretoBase({ dados }));
    expect(mov.numeroDocumento).toBeNull();

    await informarNumeroDocumentoRemetido(mov.id, '777444', ADMIN);
    const atualizado = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(atualizado.numeroDocumento).toBe('777444');
  });

  it('aceita só placaCavalo (sem placaCarreta), igual à confirmação de pré-cadastro', async () => {
    const dados = { ...dadosConfirmacaoBase(), placaCarreta: undefined };
    const mov = await criarRemetidoDireto(uuid(), lancamentoDiretoBase({ dados }));
    expect(mov.placaCavalo).toBe('ABC1D23');
    expect(mov.placaCarreta).toBeNull();
  });

  it('persiste grupo de tampão (REEMPREGO + tampao=true) com classificação G1', async () => {
    const mov = await criarRemetidoDireto(
      uuid(),
      lancamentoDiretoBase({
        grupos: [
          {
            clientId: uuid(),
            perfil: 'TR57',
            tipoMaterial: 'REEMPREGO',
            classificacao: 'G1',
            tampao: true,
            pesoInformado: 3.2,
            medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 7.5 }],
          },
        ],
      }),
    );
    expect(mov.grupos[0].tampao).toBe(true);
    expect(mov.grupos[0].classificacao).toBe('G1');
  });

  it('persiste grupo SUCATA com classificacaoSC por medição', async () => {
    const mov = await criarRemetidoDireto(
      uuid(),
      lancamentoDiretoBase({
        grupos: [
          {
            clientId: uuid(),
            perfil: 'TR57',
            tipoMaterial: 'SUCATA',
            pesoInformado: 2.4,
            medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' }],
          },
        ],
      }),
    );
    expect(mov.grupos[0].tipoMaterial).toBe('SUCATA');
    expect(mov.grupos[0].medicoes[0].classificacaoSC).toBe('SC1');
  });

  it('salva um grupo sem pesoInformado e com perfil SEM fator cadastrado, com pesoCalculado null (nunca bloqueia o salvar)', async () => {
    const original = await prisma.fatorPerfil.findUniqueOrThrow({ where: { perfil: 'TR32' } });
    await prisma.fatorPerfil.delete({ where: { perfil: 'TR32' } });
    try {
      const mov = await criarRemetidoDireto(
        uuid(),
        lancamentoDiretoBase({
          grupos: [
            {
              clientId: uuid(),
              perfil: 'TR32',
              tipoMaterial: 'NOVO',
              marca: 'NIPPON',
              medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
            },
          ],
        }),
      );
      expect(mov.grupos[0].pesoInformado).toBeNull();
      expect(mov.grupos[0].pesoCalculado).toBeNull();
    } finally {
      await prisma.fatorPerfil.create({ data: { perfil: original.perfil, fator: original.fator } });
    }
  });

  it('o remetido lançado direto é conferível normalmente pelo Administrativo', async () => {
    const mov = await criarRemetidoDireto(uuid(), lancamentoDiretoBase());
    await conferirRecebimento(mov.id, ADMIN);
    const conferido = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(conferido.status).toBe('CONFERIDO');
  });
});

describe('atualizarRemetido', () => {
  function lancamentoDiretoBase(overrides: Record<string, unknown> = {}) {
    return lancamentoDiretoRemetidoSchema.parse({
      tipoRemetido: 'VENDA',
      reservaPedido: `${RESERVA_MARCADOR}-${Math.floor(Math.random() * 1_000_000)}`,
      destino: 'Usina Rondonópolis',
      dados: dadosConfirmacaoBase(),
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          pesoInformado: 9.4,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
      ...overrides,
    });
  }

  function edicaoBase(overrides: Record<string, unknown> = {}) {
    return lancamentoDiretoRemetidoSchema.parse({
      tipoRemetido: 'TRANS',
      reservaPedido: `${RESERVA_MARCADOR}-editado-${Math.floor(Math.random() * 1_000_000)}`,
      destino: 'Usina Sorriso',
      dados: { ...dadosConfirmacaoBase(), responsavelPatio: 'Outro Responsável' },
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR68',
          tipoMaterial: 'REEMPREGO',
          classificacao: 'G1',
          pesoInformado: 20,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 12 }],
        },
      ],
      ...overrides,
    });
  }

  it('substitui tipo/reserva/destino/dados/grupos de um remetido PENDENTE_CONFERENCIA', async () => {
    const mov = await criarRemetidoDireto(uuid(), lancamentoDiretoBase());

    const atualizado = await atualizarRemetido(mov.id, edicaoBase(), ADMIN);

    expect(atualizado.status).toBe('PENDENTE_CONFERENCIA');
    expect(atualizado.destino).toBe('Usina Sorriso');
    expect(atualizado.responsavelPatio).toBe('Outro Responsável');
    expect(atualizado.remetidoDetalhe?.tipoRemetido).toBe('TRANS');
    expect(atualizado.grupos).toHaveLength(1);
    expect(atualizado.grupos[0].perfil).toBe('TR68');
    expect(Number(atualizado.grupos[0].pesoInformado)).toBe(20);
  });

  it('não deixa resíduo do grupo/medição antigos depois de editar', async () => {
    const mov = await criarRemetidoDireto(uuid(), lancamentoDiretoBase());
    const grupoAntigoId = mov.grupos[0].id;

    await atualizarRemetido(mov.id, edicaoBase(), ADMIN);

    const grupoAntigo = await prisma.grupo.findUnique({ where: { id: grupoAntigoId } });
    expect(grupoAntigo).toBeNull();
    const grupos = await prisma.grupo.findMany({ where: { movimentacaoId: mov.id } });
    expect(grupos).toHaveLength(1);
  });

  it('reabre a conferência ao editar um remetido já CONFERIDO', async () => {
    const mov = await criarRemetidoDireto(uuid(), lancamentoDiretoBase());
    await conferirRecebimento(mov.id, ADMIN);
    const conferido = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(conferido.status).toBe('CONFERIDO');

    const atualizado = await atualizarRemetido(mov.id, edicaoBase(), ADMIN);
    expect(atualizado.status).toBe('PENDENTE_CONFERENCIA');

    const historico = await prisma.historicoAlteracao.findMany({ where: { movimentacaoId: mov.id, acao: 'REABERTURA' } });
    expect(historico).toHaveLength(1);
  });

  it('não altera o status de um remetido PENDENTE_CONFERENCIA (nunca estava conferido para reabrir)', async () => {
    const mov = await criarRemetidoDireto(uuid(), lancamentoDiretoBase());
    await atualizarRemetido(mov.id, edicaoBase(), ADMIN);

    const historico = await prisma.historicoAlteracao.findMany({ where: { movimentacaoId: mov.id, acao: 'REABERTURA' } });
    expect(historico).toHaveLength(0);
  });

  it('rejeita editar um pré-cadastro ainda AGUARDANDO_CHEGADA (não há grupos para editar)', async () => {
    const preCadastro = await criarPreCadastro();
    await expect(atualizarRemetido(preCadastro.id, edicaoBase(), ADMIN)).rejects.toThrow(/não foi confirmado/i);
  });

  it('rejeita editar passando o id de um Recebimento (endurecimento contra confusão de tipo)', async () => {
    const recebimento = await criarRecebimentoMarcado();
    await expect(atualizarRemetido(recebimento.id, edicaoBase(), ADMIN)).rejects.toThrow(/não encontrado/i);
  });
});

describe('informarNumeroDocumentoRemetido', () => {
  async function confirmarSemNF() {
    const preCadastro = await criarPreCadastro();
    const input = confirmacaoRemetidoSchema.parse({
      dados: { ...dadosConfirmacaoBase(), numeroDocumento: undefined },
      grupos: [
        {
          clientId: uuid(),
          perfil: 'TR22',
          tipoMaterial: 'NOVO',
          marca: 'NIPPON',
          pesoInformado: 5,
          medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }],
        },
      ],
    });
    return confirmarRemetido(preCadastro.id, input);
  }

  it('completa a NF que o Pátio deixou em aberto', async () => {
    const confirmado = await confirmarSemNF();
    expect(confirmado.numeroDocumento).toBeNull();

    await informarNumeroDocumentoRemetido(confirmado.id, '999888', ADMIN);
    const atualizado = await prisma.movimentacao.findUniqueOrThrow({ where: { id: confirmado.id } });
    expect(atualizado.numeroDocumento).toBe('999888');
  });

  it('reabre a conferência ao corrigir a NF de um remetido já CONFERIDO', async () => {
    const confirmado = await confirmarSemNF();
    await informarNumeroDocumentoRemetido(confirmado.id, '111000', ADMIN);
    await conferirRecebimento(confirmado.id, ADMIN);

    const conferido = await prisma.movimentacao.findUniqueOrThrow({ where: { id: confirmado.id } });
    expect(conferido.status).toBe('CONFERIDO');

    await informarNumeroDocumentoRemetido(confirmado.id, '222000', ADMIN);
    const reaberto = await prisma.movimentacao.findUniqueOrThrow({ where: { id: confirmado.id } });
    expect(reaberto.status).toBe('PENDENTE_CONFERENCIA');
    expect(reaberto.numeroDocumento).toBe('222000');
  });

  it('rejeita informar NF passando o id de um Recebimento (endurecimento contra confusão de tipo)', async () => {
    const recebimento = await criarRecebimentoMarcado();
    await expect(informarNumeroDocumentoRemetido(recebimento.id, '123456', ADMIN)).rejects.toThrow(/não encontrado/i);
  });

  afterAll(async () => {
    const ids = (
      await prisma.movimentacao.findMany({
        where: { OR: [{ reservaPedido: { startsWith: RESERVA_MARCADOR } }, { origem: RESERVA_MARCADOR }] },
        select: { id: true },
      })
    ).map((m) => m.id);
    await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: { in: ids } } } });
    await prisma.grupo.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.remetidoDetalhe.deleteMany({ where: { movimentacaoId: { in: ids } } });
    await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });
});
