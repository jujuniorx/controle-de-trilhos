import { prisma } from '@/lib/db';
import { arredondar3 } from '@/lib/domain/regras';

export interface UsuarioAdmin {
  userId: string;
  nome: string;
}

export class ConferenciaError extends Error {}

/**
 * Informa (primeiro lançamento) ou corrige o peso real da sucata de uma
 * Movimentacao. O peso pertence sempre à Movimentacao inteira — nunca a um
 * Grupo — mesmo quando há vários grupos de sucata no mesmo carregamento.
 *
 * Se a movimentação já estava CONFERIDO, corrigir o peso a reabre para
 * PENDENTE_CONFERENCIA (edição de dado conferido sempre reabre a conferência).
 */
export async function informarPesoSucataReal(
  movimentacaoId: string,
  peso: number,
  usuario: UsuarioAdmin,
): Promise<void> {
  if (!Number.isFinite(peso) || peso <= 0) {
    throw new ConferenciaError('Peso inválido.');
  }

  const mov = await prisma.movimentacao.findUnique({
    where: { id: movimentacaoId },
    include: { grupos: { select: { tipoMaterial: true } } },
  });
  if (!mov) throw new ConferenciaError('Recebimento não encontrado.');

  const temSucata = mov.grupos.some((g) => g.tipoMaterial === 'SUCATA');
  if (!temSucata) throw new ConferenciaError('Este recebimento não possui grupo de sucata.');

  const valorAnterior = mov.pesoSucataReal != null ? Number(mov.pesoSucataReal) : null;
  const valorNovo = arredondar3(peso);
  const reabrindo = mov.status === 'CONFERIDO';

  await prisma.$transaction(async (tx) => {
    await tx.movimentacao.update({
      where: { id: movimentacaoId },
      data: {
        pesoSucataReal: valorNovo,
        ...(reabrindo ? { status: 'PENDENTE_CONFERENCIA', conferidoPorId: null, conferidoEm: null } : {}),
      },
    });

    await tx.historicoAlteracao.create({
      data: {
        movimentacaoId,
        usuarioId: usuario.userId,
        usuarioNome: usuario.nome,
        acao: 'PESO_INFORMADO',
        campo: 'pesoSucataReal',
        valorAntigo: valorAnterior != null ? String(valorAnterior) : null,
        valorNovo: String(valorNovo),
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

/**
 * Marca a movimentação como CONFERIDO. Toda a validação é refeita aqui no
 * servidor, lendo o estado atual do banco — nunca confia em nada vindo do
 * cliente além do id.
 */
export async function conferirRecebimento(movimentacaoId: string, usuario: UsuarioAdmin): Promise<void> {
  const mov = await prisma.movimentacao.findUnique({
    where: { id: movimentacaoId },
    include: { grupos: { select: { tipoMaterial: true } } },
  });
  if (!mov) throw new ConferenciaError('Recebimento não encontrado.');
  if (mov.status !== 'PENDENTE_CONFERENCIA') {
    throw new ConferenciaError('Este recebimento não está pendente de conferência.');
  }

  const temSucata = mov.grupos.some((g) => g.tipoMaterial === 'SUCATA');
  if (temSucata && mov.pesoSucataReal == null) {
    throw new ConferenciaError('O peso da sucata está pendente. Informe o peso real antes de conferir.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.movimentacao.update({
      where: { id: movimentacaoId },
      data: { status: 'CONFERIDO', conferidoPorId: usuario.userId, conferidoEm: new Date() },
    });

    await tx.historicoAlteracao.create({
      data: {
        movimentacaoId,
        usuarioId: usuario.userId,
        usuarioNome: usuario.nome,
        acao: 'CONFERENCIA',
        campo: 'status',
        valorAntigo: 'PENDENTE_CONFERENCIA',
        valorNovo: 'CONFERIDO',
      },
    });
  });
}
