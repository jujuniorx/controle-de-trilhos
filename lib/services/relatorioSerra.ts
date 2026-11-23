import { prisma } from '@/lib/db';
import { montarRelatorioSerra, type Composicao, type RelatorioSerra } from '@/lib/domain/relatorioSerra';

/** Relatório da serra até a data pedida (AAAA-MM-DD), com as barras lançadas na Usina (composições W61 e W62). */
export async function relatorioSerra(ate: string): Promise<RelatorioSerra> {
  const ano = Number(ate.slice(0, 4));
  const linhas = await prisma.composicaoDia.findMany({
    where: { data: { gte: new Date(Date.UTC(ano, 0, 1)), lte: new Date(`${ate}T00:00:00Z`) } },
    select: { data: true, ativo: true, barras: true },
  });
  return montarRelatorioSerra(
    linhas.map((l) => ({ data: l.data.toISOString().slice(0, 10), ativo: l.ativo as Composicao, barras: l.barras })),
    ate,
  );
}
