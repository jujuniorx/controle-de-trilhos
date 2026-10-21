import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { normalizarLocal } from '@/lib/domain/local';

/**
 * Lixeira: ao excluir uma movimentação, uma cópia completa (JSON) fica guardada em
 * MovimentacaoExcluida. Aqui ficam o "tirar a foto" (snapshot) e o "recolocar" (restaurar).
 */

type DadosMovimentacaoSnapshot = Prisma.MovimentacaoGetPayload<{
  include: { remetidoDetalhe: true; grupos: { include: { medicoes: true } }; anexos: true; historico: true };
}>;

/** Campos que são datas: no JSON viram texto ISO e precisam voltar a ser Date ao restaurar. */
const CAMPOS_DE_DATA = new Set(['dataMovimentacao', 'createdAt', 'conferidoEm', 'uploadedAt', 'timestamp']);

/** Converte, em qualquer profundidade, os campos de data de texto ISO de volta para Date. */
export function reviverDatas<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map((v) => reviverDatas(v)) as unknown as T;
  if (valor && typeof valor === 'object') {
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
      saida[chave] = CAMPOS_DE_DATA.has(chave) && typeof v === 'string' ? new Date(v) : reviverDatas(v);
    }
    return saida as T;
  }
  return valor;
}

function fmtDataCurta(d: Date | null): string | null {
  return d ? d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : null;
}

/** Texto que a operação reconhece: "NF 347212-1 · CRUZEIRO · 08/10/2026" (nunca só o id técnico). */
export function rotuloDaMovimentacao(mov: {
  id: string;
  numeroDocumento: string | null;
  origem: string | null;
  destino: string | null;
  dataMovimentacao: Date | null;
}): string {
  const partes = [
    mov.numeroDocumento ? `NF ${mov.numeroDocumento}` : null,
    normalizarLocal(mov.destino ?? mov.origem) || null,
    fmtDataCurta(mov.dataMovimentacao),
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : mov.id;
}

/** Lê a movimentação inteira (com tudo que pertence a ela) e devolve pronta para guardar como JSON. */
export async function tirarSnapshot(movimentacaoId: string): Promise<{
  mov: DadosMovimentacaoSnapshot;
  json: Prisma.InputJsonValue;
} | null> {
  const mov = await prisma.movimentacao.findUnique({
    where: { id: movimentacaoId },
    include: { remetidoDetalhe: true, grupos: { include: { medicoes: true } }, anexos: true, historico: true },
  });
  if (!mov) return null;
  // JSON.stringify: Decimal vira texto e Date vira ISO — o Prisma aceita os dois de volta.
  return { mov, json: JSON.parse(JSON.stringify(mov)) as Prisma.InputJsonValue };
}

export function listarLixeira() {
  return prisma.movimentacaoExcluida.findMany({
    where: { restauradoEm: null },
    orderBy: { excluidoEm: 'desc' },
    select: { id: true, tipo: true, rotulo: true, excluidoPorNome: true, excluidoEm: true, motivo: true },
  });
}

/** Chegadas excluídas pelo Pátio (ainda na lixeira). */
export function listarChegadasExcluidas() {
  return prisma.chegadaCaminhao.findMany({
    where: { excluidaEm: { not: null } },
    orderBy: { excluidaEm: 'desc' },
    select: {
      id: true,
      origem: true,
      placaCarreta: true,
      placaCavalo: true,
      transportadora: true,
      excluidaEm: true,
      excluidaPor: true,
      excluidaMotivo: true,
    },
  });
}

/** Recoloca uma chegada excluída pelo Pátio: volta para a lista de onde saiu. */
export async function restaurarChegada(id: string): Promise<void> {
  const r = await prisma.chegadaCaminhao.updateMany({
    where: { id, excluidaEm: { not: null } },
    data: { excluidaEm: null, excluidaPor: null, excluidaMotivo: null },
  });
  if (r.count === 0) throw new ErroRegraNegocio('Esta chegada não está mais na lixeira.');
}

/** Recoloca uma movimentação excluída exatamente como estava (grupos, medições, anexos e histórico). */
export async function restaurarMovimentacao(
  lixeiraId: string,
  ator: { userId: string; nome: string },
): Promise<{ rotulo: string; tipo: string; movimentacaoId: string }> {
  const registro = await prisma.movimentacaoExcluida.findUnique({ where: { id: lixeiraId } });
  if (!registro || registro.restauradoEm) {
    throw new ErroRegraNegocio('Este item não está mais na lixeira (talvez já tenha sido restaurado).');
  }

  const snap = reviverDatas(registro.dados as unknown as DadosMovimentacaoSnapshot);
  const { remetidoDetalhe, grupos, anexos, historico, chegadaIdOrigem, ...mov } = snap as typeof snap & { chegadaIdOrigem?: string };

  await prisma.$transaction(
    async (tx) => {
      const conflito = await tx.movimentacao.findFirst({
        where: { OR: [{ id: mov.id }, { clientId: mov.clientId }] },
        select: { id: true },
      });
      if (conflito) {
        throw new ErroRegraNegocio(
          'Já existe uma movimentação com este mesmo identificador (ela pode ter sido enviada de novo pelo tablet). Confira a lista antes de restaurar.',
        );
      }

      await tx.movimentacao.create({ data: mov as Prisma.MovimentacaoUncheckedCreateInput });
      if (remetidoDetalhe) {
        await tx.remetidoDetalhe.create({ data: remetidoDetalhe as Prisma.RemetidoDetalheUncheckedCreateInput });
      }
      if (grupos.length > 0) {
        await tx.grupo.createMany({
          data: grupos.map(({ medicoes: _medicoes, ...g }) => g as Prisma.GrupoCreateManyInput),
        });
        const medicoes = grupos.flatMap((g) => g.medicoes);
        if (medicoes.length > 0) await tx.medicao.createMany({ data: medicoes as Prisma.MedicaoCreateManyInput[] });
      }
      if (anexos.length > 0) await tx.anexo.createMany({ data: anexos as Prisma.AnexoCreateManyInput[] });
      if (historico.length > 0) {
        await tx.historicoAlteracao.createMany({ data: historico as Prisma.HistoricoAlteracaoCreateManyInput[] });
      }

      await tx.historicoAlteracao.create({
        data: {
          movimentacaoId: mov.id,
          usuarioId: ator.userId,
          usuarioNome: ator.nome,
          acao: 'RESTAURADO',
        },
      });
      // Recebimento que veio de uma chegada: religa a chegada se ela ainda estiver sem recebimento.
      if (chegadaIdOrigem) {
        await tx.chegadaCaminhao.updateMany({
          where: { id: chegadaIdOrigem, movimentacaoId: null },
          data: { movimentacaoId: mov.id, recebidaEm: new Date() },
        });
      }
      await tx.movimentacaoExcluida.update({ where: { id: lixeiraId }, data: { restauradoEm: new Date() } });
    },
    { timeout: 30_000, maxWait: 10_000 },
  );

  return { rotulo: registro.rotulo, tipo: registro.tipo, movimentacaoId: mov.id };
}
