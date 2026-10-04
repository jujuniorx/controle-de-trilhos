import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { criarRecebimentoCaminhao, buscarMovimentacaoDetalhe, resumoPeso } from '@/lib/services/movimentacao';
import { informarPesoSucataReal, conferirRecebimento, ConferenciaError } from '@/lib/services/conferencia';
import { recebimentoCaminhaoSchema } from '@/lib/validation/recebimento';
import { criarPreCadastroRemetido, confirmarRemetido } from '@/lib/services/remetido';
import { preCadastroRemetidoSchema, confirmacaoRemetidoSchema } from '@/lib/validation/remetido';

const uuid = () => crypto.randomUUID();
const RESPONSAVEL = 'Teste Integração Conferencia';
const ADMIN = { userId: 'admin-teste-conferencia', nome: 'Admin Teste Conferência' };

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

async function criarSemSucata() {
  const input = recebimentoCaminhaoSchema.parse({
    clientId: uuid(),
    dados: dadosBase(),
    grupos: [
      {
        clientId: uuid(),
        perfil: 'TR22',
        tipoMaterial: 'NOVO',
        medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 10 }], // 0.22 t
      },
    ],
  });
  return criarRecebimentoCaminhao(input);
}

async function criarComUmaSucata() {
  const input = recebimentoCaminhaoSchema.parse({
    clientId: uuid(),
    dados: dadosBase(),
    grupos: [
      {
        clientId: uuid(),
        perfil: 'TR22',
        tipoMaterial: 'NOVO',
        medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 4.65 }], // 0.102 t
      },
      {
        clientId: uuid(),
        perfil: 'TR57',
        tipoMaterial: 'SUCATA',
        medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' }],
      },
    ],
  });
  return criarRecebimentoCaminhao(input);
}

async function criarComDuasSucatas() {
  const input = recebimentoCaminhaoSchema.parse({
    clientId: uuid(),
    dados: dadosBase(),
    grupos: [
      {
        clientId: uuid(),
        perfil: 'TR57',
        tipoMaterial: 'SUCATA',
        medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8.1, classificacaoSC: 'SC1' }],
      },
      {
        clientId: uuid(),
        perfil: 'TR60',
        tipoMaterial: 'SUCATA',
        medicoes: [{ clientId: uuid(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 2.0, classificacaoSC: 'SC3' }],
      },
    ],
  });
  return criarRecebimentoCaminhao(input);
}

describe('conferirRecebimento', () => {
  it('1. recebimento sem sucata pode ser marcado como CONFERIDO', async () => {
    const mov = await criarSemSucata();
    await conferirRecebimento(mov.id, ADMIN);
    const atualizado = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(atualizado.status).toBe('CONFERIDO');
    expect(atualizado.conferidoPorId).toBe(ADMIN.userId);
    expect(atualizado.conferidoEm).not.toBeNull();
  });

  it('2. recebimento com sucata sem peso real NÃO pode ser marcado como CONFERIDO', async () => {
    const mov = await criarComUmaSucata();
    await expect(conferirRecebimento(mov.id, ADMIN)).rejects.toThrow(/peso da sucata está pendente/i);
    const atualizado = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(atualizado.status).toBe('PENDENTE_CONFERENCIA');
  });

  it('3. informar o peso real da sucata permite avançar para CONFERIDO', async () => {
    const mov = await criarComUmaSucata();
    await informarPesoSucataReal(mov.id, 1.25, ADMIN);
    await conferirRecebimento(mov.id, ADMIN);
    const atualizado = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(atualizado.status).toBe('CONFERIDO');
  });

  it('15. não permite CONFERIDO ignorando as regras, mesmo chamando o serviço diretamente sem passar por nenhuma checagem de UI', async () => {
    const mov = await criarComUmaSucata();
    // Nenhum peso foi informado — chama o serviço direto, como se o cliente tivesse tentado burlar o botão desabilitado.
    await expect(conferirRecebimento(mov.id, ADMIN)).rejects.toThrow(ConferenciaError);
  });
});

describe('informarPesoSucataReal', () => {
  it('4/5. o peso pertence à Movimentacao — cobre todos os grupos de sucata, mesmo havendo mais de um', async () => {
    const mov = await criarComDuasSucatas();
    await informarPesoSucataReal(mov.id, 3.5, ADMIN);
    const atualizado = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id }, include: { grupos: true } });
    expect(Number(atualizado.pesoSucataReal)).toBe(3.5);
    expect(atualizado.grupos.filter((g) => g.tipoMaterial === 'SUCATA')).toHaveLength(2);
    // Nenhum campo de peso real existe no Grupo — só metrosTotal/pesoCalculado (null para sucata).
    atualizado.grupos.forEach((g) => expect((g as unknown as Record<string, unknown>).pesoReal).toBeUndefined());
    await conferirRecebimento(mov.id, ADMIN); // um único peso já basta para liberar a conferência
    expect((await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } })).status).toBe('CONFERIDO');
  });

  it('6. primeiro lançamento gera histórico NULL → peso informado', async () => {
    const mov = await criarComUmaSucata();
    await informarPesoSucataReal(mov.id, 1.25, ADMIN);
    const historico = await prisma.historicoAlteracao.findMany({
      where: { movimentacaoId: mov.id, acao: 'PESO_INFORMADO' },
      orderBy: { timestamp: 'asc' },
    });
    expect(historico).toHaveLength(1);
    expect(historico[0].valorAntigo).toBeNull();
    expect(historico[0].valorNovo).toBe('1.25');
  });

  it('7. alteração posterior gera novo histórico peso anterior → peso novo', async () => {
    const mov = await criarComUmaSucata();
    await informarPesoSucataReal(mov.id, 1.25, ADMIN);
    await informarPesoSucataReal(mov.id, 1.275, ADMIN);
    const historico = await prisma.historicoAlteracao.findMany({
      where: { movimentacaoId: mov.id, acao: 'PESO_INFORMADO' },
      orderBy: { timestamp: 'asc' },
    });
    expect(historico).toHaveLength(2);
    expect(historico[1].valorAntigo).toBe('1.25');
    expect(historico[1].valorNovo).toBe('1.275');
  });

  it('reabre para PENDENTE_CONFERENCIA quando o peso é corrigido depois de já CONFERIDO', async () => {
    const mov = await criarComUmaSucata();
    await informarPesoSucataReal(mov.id, 1.25, ADMIN);
    await conferirRecebimento(mov.id, ADMIN);
    expect((await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } })).status).toBe('CONFERIDO');

    await informarPesoSucataReal(mov.id, 1.3, ADMIN);
    const atualizado = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(atualizado.status).toBe('PENDENTE_CONFERENCIA');
    expect(atualizado.conferidoPorId).toBeNull();

    const reabertura = await prisma.historicoAlteracao.findMany({ where: { movimentacaoId: mov.id, acao: 'REABERTURA' } });
    expect(reabertura).toHaveLength(1);
    expect(reabertura[0].valorAntigo).toBe('CONFERIDO');
    expect(reabertura[0].valorNovo).toBe('PENDENTE_CONFERENCIA');
  });

  it('13/14. rejeita peso negativo, zero ou não finito, sem alterar nada no banco', async () => {
    const mov = await criarComUmaSucata();
    await expect(informarPesoSucataReal(mov.id, -1, ADMIN)).rejects.toThrow(ConferenciaError);
    await expect(informarPesoSucataReal(mov.id, 0, ADMIN)).rejects.toThrow(ConferenciaError);
    await expect(informarPesoSucataReal(mov.id, NaN, ADMIN)).rejects.toThrow(ConferenciaError);
    const atualizado = await prisma.movimentacao.findUniqueOrThrow({ where: { id: mov.id } });
    expect(atualizado.pesoSucataReal).toBeNull();
  });

  it('rejeita informar peso para um recebimento sem nenhum grupo de sucata', async () => {
    const mov = await criarSemSucata();
    await expect(informarPesoSucataReal(mov.id, 1, ADMIN)).rejects.toThrow(/não possui grupo de sucata/);
  });

  it('rejeita informar peso passando o id de um Remetido (endurecimento contra confusão de tipo)', async () => {
    const preCadastro = await criarPreCadastroRemetido(
      crypto.randomUUID(),
      preCadastroRemetidoSchema.parse({ tipoRemetido: 'VENDA', reservaPedido: 'TESTE-CONFERENCIA-REMETIDO', destino: 'X' }),
    );
    const remetido = await confirmarRemetido(
      preCadastro.id,
      confirmacaoRemetidoSchema.parse({
        dados: {
          data: '2026-10-04',
          numeroDocumento: String(Math.floor(Math.random() * 900000) + 100000),
          placaCavalo: 'ABC1D23',
          responsavelPatio: RESPONSAVEL,
        },
        grupos: [
          {
            clientId: crypto.randomUUID(),
            perfil: 'TR22',
            tipoMaterial: 'SUCATA',
            pesoInformado: 1,
            medicoes: [{ clientId: crypto.randomUUID(), modo: 'INDIVIDUAL', quantidade: 1, comprimento: 8, classificacaoSC: 'SC1' }],
          },
        ],
      }),
    );

    await expect(informarPesoSucataReal(remetido.id, 1, ADMIN)).rejects.toThrow(/não encontrado/i);
  });

  it('16. toda alteração de peso registra usuário e data/hora no histórico', async () => {
    const mov = await criarComUmaSucata();
    await informarPesoSucataReal(mov.id, 1.25, ADMIN);
    const [entrada] = await prisma.historicoAlteracao.findMany({ where: { movimentacaoId: mov.id, acao: 'PESO_INFORMADO' } });
    expect(entrada.usuarioId).toBe(ADMIN.userId);
    expect(entrada.usuarioNome).toBe(ADMIN.nome);
    expect(entrada.timestamp).toBeInstanceOf(Date);
  });
});

describe('resumoPeso durante a conferência', () => {
  it('11. "peso até agora" considera só NOVO+REEMPREGO enquanto a sucata está pendente', async () => {
    const mov = await criarComUmaSucata();
    const detalhe = await buscarMovimentacaoDetalhe(mov.id);
    const resumo = resumoPeso(detalhe!);
    expect(resumo.pendente).toBe(true);
    expect(resumo.pesoNovoReemprego).toBe(0.102);
    expect(resumo.pesoTotal).toBeNull();
  });

  it('12. "peso total" soma NOVO+REEMPREGO+pesoSucataReal depois de informado', async () => {
    const mov = await criarComUmaSucata();
    await informarPesoSucataReal(mov.id, 1.25, ADMIN);
    const detalhe = await buscarMovimentacaoDetalhe(mov.id);
    const resumo = resumoPeso(detalhe!);
    expect(resumo.pendente).toBe(false);
    expect(resumo.pesoTotal).toBe(1.352); // 0.102 + 1.25
  });
});

afterAll(async () => {
  const ids = (
    await prisma.movimentacao.findMany({ where: { responsavelPatio: RESPONSAVEL }, select: { id: true } })
  ).map((m) => m.id);
  await prisma.historicoAlteracao.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.anexo.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.medicao.deleteMany({ where: { grupo: { movimentacaoId: { in: ids } } } });
  await prisma.grupo.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.remetidoDetalhe.deleteMany({ where: { movimentacaoId: { in: ids } } });
  await prisma.movimentacao.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});
