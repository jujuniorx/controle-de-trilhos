import { prisma } from '@/lib/db';
import { normalizarLocal } from '@/lib/domain/local';

/**
 * Origens que já foram digitadas na Portaria (carretas e caminhões), sem repetição, para o campo
 * sugerir o que já existe e a mesma cidade não virar três grafias diferentes.
 */
export async function listarOrigensUsadas(): Promise<string[]> {
  const [chegadas, carretas] = await Promise.all([
    prisma.chegadaCaminhao.findMany({ where: { origem: { not: null } }, select: { origem: true }, distinct: ['origem'], take: 300 }),
    prisma.movimentacao.findMany({ where: { tipo: 'REMETIDO', origem: { not: null } }, select: { origem: true }, distinct: ['origem'], take: 300 }),
  ]);
  const todas = [...chegadas, ...carretas].map((r) => normalizarLocal(r.origem)).filter(Boolean);
  return [...new Set(todas)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
