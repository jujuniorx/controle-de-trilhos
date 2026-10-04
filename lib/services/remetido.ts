import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { calcularMetros } from '@/lib/services/calculo';
import { registrarHistorico } from '@/lib/services/historico';
import { arredondar3 } from '@/lib/domain/regras';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { MARCA_LABEL } from '@/lib/validation/recebimento';
import type { PreCadastroRemetidoInput, ConfirmacaoRemetidoInput, GrupoRemetidoInput } from '@/lib/validation/remetido';
import type { UsuarioAdmin } from '@/lib/services/conferencia';

export type MovimentacaoRemetidoComGrupos = Prisma.MovimentacaoGetPayload<{
  include: { grupos: { include: { medicoes: true } }; remetidoDetalhe: true };
}>;

export async function criarPreCadastroRemetido(
  clientId: string,
  input: PreCadastroRemetidoInput,
): Promise<MovimentacaoRemetidoComGrupos> {
  const movimentacao = await prisma.movimentacao.create({
    data: {
      clientId,
      tipo: 'REMETIDO',
      tipoDocumento: 'NF',
      numeroDocumento: input.numeroDocumento ?? null,
      tipoTransporte: 'CAMINHAO',
      destino: input.destino,
      reservaPedido: input.reservaPedido,
      status: 'AGUARDANDO_CHEGADA',
      remetidoDetalhe: { create: { tipoRemetido: input.tipoRemetido } },
    },
    include: { grupos: { include: { medicoes: true } }, remetidoDetalhe: true },
  });

  await registrarHistorico({
    movimentacaoId: movimentacao.id,
    usuarioNome: 'Administrativo',
    acao: 'PRE_CADASTRO',
  });

  return movimentacao;
}

/** Deriva o texto gravado em Grupo.fabricante a partir da marca fechada (ou do texto livre quando "OUTROS"). */
function resolverFabricante(grupo: Extract<GrupoRemetidoInput, { tipoMaterial: 'NOVO' }>): string | null {
  if (!grupo.marca) return null;
  return grupo.marca === 'OUTROS' ? grupo.fabricanteOutro ?? null : MARCA_LABEL[grupo.marca];
}

export async function confirmarRemetido(
  movimentacaoId: string,
  input: ConfirmacaoRemetidoInput,
): Promise<MovimentacaoRemetidoComGrupos> {
  const existente = await prisma.movimentacao.findUnique({ where: { id: movimentacaoId } });
  if (!existente || existente.tipo !== 'REMETIDO') throw new ErroRegraNegocio('Remetido não encontrado.');
  if (existente.status !== 'AGUARDANDO_CHEGADA') {
    throw new ErroRegraNegocio('Este remetido não está mais aguardando chegada.');
  }

  const movimentacao = await prisma.$transaction(async (tx) => {
    const mov = await tx.movimentacao.update({
      where: { id: movimentacaoId },
      data: {
        status: 'PENDENTE_CONFERENCIA',
        numeroDocumento: input.dados.numeroDocumento ?? existente.numeroDocumento,
        dataMovimentacao: new Date(`${input.dados.data}T00:00:00`),
        placaCavalo: input.dados.placaCavalo ?? null,
        placaCarreta: input.dados.placaCarreta ?? null,
        transportadora: input.dados.transportadora ?? null,
        responsavelPatio: input.dados.responsavelPatio,
      },
    });

    for (const grupo of input.grupos) {
      const metrosPorMedicao = grupo.medicoes.map((m) => calcularMetros(m.quantidade, m.comprimento));
      const metrosTotal = metrosPorMedicao.reduce((a, b) => a + b, 0);

      const grupoCriado = await tx.grupo.create({
        data: {
          clientId: grupo.clientId,
          movimentacaoId: mov.id,
          perfil: grupo.perfil,
          tipoMaterial: grupo.tipoMaterial,
          classificacao: grupo.tipoMaterial === 'REEMPREGO' ? grupo.classificacao : null,
          tampao: grupo.tipoMaterial === 'REEMPREGO' ? Boolean(grupo.tampao) : false,
          fabricante: grupo.tipoMaterial === 'NOVO' ? resolverFabricante(grupo) : null,
          metrosTotal,
          pesoCalculado: null,
          pesoInformado: grupo.pesoInformado,
        },
      });

      for (const [i, medicao] of grupo.medicoes.entries()) {
        await tx.medicao.create({
          data: {
            clientId: medicao.clientId,
            grupoId: grupoCriado.id,
            modo: medicao.modo,
            quantidade: medicao.quantidade,
            comprimento: medicao.comprimento,
            metros: metrosPorMedicao[i],
            classificacaoSC: grupo.tipoMaterial === 'SUCATA' ? medicao.classificacaoSC : null,
          },
        });
      }
    }

    return tx.movimentacao.findUniqueOrThrow({
      where: { id: mov.id },
      include: { grupos: { include: { medicoes: true } }, remetidoDetalhe: true },
    });
  });

  await registrarHistorico({
    movimentacaoId: movimentacao.id,
    usuarioNome: `${input.dados.responsavelPatio} (pátio)`,
    acao: 'CONFIRMACAO_CHEGADA',
  });

  // TODO(Estoque): a baixa de estoque do material remetido não existe ainda —
  // não há módulo de Estoque no sistema. Quando existir, este é o ponto onde a
  // baixa deveria ocorrer (ou no momento da CONFERIDO pelo Administrativo).
  // TODO(Offline): esta confirmação é só online (sem fila local/Dexie), por
  // decisão explícita para não arriscar o motor de sincronização do Recebimento
  // perto do prazo. Se o Pátio operar sem conexão no momento da confirmação,
  // avaliar estender o /api/sync para este payload numa rodada futura.

  return movimentacao;
}

/**
 * Completa a NF que o Pátio deixou em aberto na confirmação. Se o remetido já
 * estava CONFERIDO, corrigir a NF reabre para PENDENTE_CONFERENCIA — mesma
 * regra já usada para corrigir pesoSucataReal: dado conferido que muda sempre
 * reabre a conferência.
 */
export async function informarNumeroDocumentoRemetido(
  movimentacaoId: string,
  numeroDocumento: string,
  usuario: UsuarioAdmin,
): Promise<void> {
  const mov = await prisma.movimentacao.findUnique({ where: { id: movimentacaoId } });
  if (!mov || mov.tipo !== 'REMETIDO') throw new ErroRegraNegocio('Remetido não encontrado.');

  const valorAnterior = mov.numeroDocumento;
  const reabrindo = mov.status === 'CONFERIDO';

  await prisma.$transaction(async (tx) => {
    await tx.movimentacao.update({
      where: { id: movimentacaoId },
      data: {
        numeroDocumento,
        ...(reabrindo ? { status: 'PENDENTE_CONFERENCIA', conferidoPorId: null, conferidoEm: null } : {}),
      },
    });

    await tx.historicoAlteracao.create({
      data: {
        movimentacaoId,
        usuarioId: usuario.userId,
        usuarioNome: usuario.nome,
        acao: 'NF_INFORMADA',
        campo: 'numeroDocumento',
        valorAntigo: valorAnterior,
        valorNovo: numeroDocumento,
      },
    });

    if (reabrindo) {
      await tx.historicoAlteracao.create({
        data: {
          movimentacaoId,
          usuarioId: usuario.userId,
          usuarioNome: usuario.nome,
          acao: 'REABERTURA',
          campo: 'status',
          valorAntigo: 'CONFERIDO',
          valorNovo: 'PENDENTE_CONFERENCIA',
        },
      });
    }
  });
}

/** Soma simples do pesoInformado de cada grupo — Remetido nunca calcula por fator nem tem peso pendente. */
export function resumoPesoRemetido(movimentacao: MovimentacaoRemetidoComGrupos): number {
  return arredondar3(movimentacao.grupos.reduce((acc, g) => acc + Number(g.pesoInformado ?? 0), 0));
}

export function buscarRemetidoDetalhe(id: string): Promise<MovimentacaoRemetidoComGrupos | null> {
  return prisma.movimentacao.findUnique({
    where: { id, tipo: 'REMETIDO' },
    include: { grupos: { include: { medicoes: true } }, remetidoDetalhe: true },
  });
}

export function listarAguardandoChegada() {
  return prisma.movimentacao.findMany({
    where: { tipo: 'REMETIDO', status: 'AGUARDANDO_CHEGADA' },
    include: { remetidoDetalhe: true },
    orderBy: { id: 'desc' },
  });
}
