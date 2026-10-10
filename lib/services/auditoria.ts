import { prisma } from '@/lib/db';

/** Registra quem fez o quê. Falha de auditoria nunca deve derrubar a ação principal. */
export async function registrarAuditoria(
  ator: { userId: string; nome: string },
  acao: string,
  descricao: string,
): Promise<void> {
  try {
    await prisma.logAuditoria.create({
      data: { usuarioId: ator.userId, usuarioNome: ator.nome, acao, descricao },
    });
  } catch (e) {
    console.error('Falha ao registrar auditoria', e);
  }
}

export function listarAuditoria(limite = 200) {
  return prisma.logAuditoria.findMany({ orderBy: { criadoEm: 'desc' }, take: limite });
}
