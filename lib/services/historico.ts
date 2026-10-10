import { prisma } from '@/lib/db';

interface RegistrarHistoricoParams {
  movimentacaoId: string;
  usuarioId?: string;
  usuarioNome: string;
  acao: string;
  campo?: string;
  valorAntigo?: string;
  valorNovo?: string;
}

export async function registrarHistorico(params: RegistrarHistoricoParams): Promise<void> {
  await prisma.historicoAlteracao.create({ data: params });
}
