import { prisma } from '@/lib/db';

export const TIPOS_ESTOQUE = ['PERFIL', 'TALA', 'LISA'] as const;
export type TipoEstoque = (typeof TIPOS_ESTOQUE)[number];

export const ROTULO_TIPO_ESTOQUE: Record<TipoEstoque, string> = {
  PERFIL: 'Perfis',
  TALA: 'Talas',
  LISA: 'Barras lisas',
};

export interface ItemEstoque {
  id: string;
  tipo: TipoEstoque;
  nome: string;
  fabricante: string | null;
  quantidadeT: number;
  quantidadeM: number;
  atualizadoEm: string;
}

/** Todos os itens do estoque, agrupados pela ordem do tipo e do nome. */
export async function listarEstoque(): Promise<ItemEstoque[]> {
  const linhas = await prisma.estoqueItem.findMany({ orderBy: [{ tipo: 'asc' }, { nome: 'asc' }] });
  return linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo as TipoEstoque,
    nome: l.nome,
    fabricante: l.fabricante,
    quantidadeT: Number(l.quantidadeT),
    quantidadeM: Number(l.quantidadeM),
    atualizadoEm: l.atualizadoEm.toISOString(),
  }));
}

export interface ValoresItemEstoque {
  id?: string;
  tipo: TipoEstoque;
  nome: string;
  fabricante: string | null;
  quantidadeT: number;
  quantidadeM: number;
}

/** Cria um item (sem id) ou atualiza as quantidades e os dados de um existente. */
export async function salvarItemEstoque(v: ValoresItemEstoque): Promise<void> {
  const dados = {
    tipo: v.tipo,
    nome: v.nome,
    fabricante: v.fabricante,
    quantidadeT: v.quantidadeT,
    quantidadeM: v.quantidadeM,
  };
  if (v.id) {
    await prisma.estoqueItem.update({ where: { id: v.id }, data: dados });
  } else {
    await prisma.estoqueItem.create({ data: dados });
  }
}

export async function excluirItemEstoque(id: string): Promise<void> {
  await prisma.estoqueItem.delete({ where: { id } });
}
