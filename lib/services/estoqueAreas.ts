import { prisma } from '@/lib/db';

export const UNIDADES_MATERIAL = ['un', 'par', 'kg', 'L', 'm'] as const;

export interface AreaEstoque {
  id: string;
  nome: string;
}

export interface MaterialEstoque {
  id: string;
  nome: string;
  unidade: string;
  fabricante: string | null;
  quantidade: number;
  atualizadoEm: string;
}

export interface MovimentoEstoque {
  id: string;
  tipo: string;
  quantidade: number;
  saldoApos: number;
  motivo: string | null;
  documento: string | null;
  responsavel: string;
  criadoEm: string;
}

/** Áreas na ordem em que aparecem nas abas. */
export async function listarAreasEstoque(): Promise<AreaEstoque[]> {
  const linhas = await prisma.estoqueArea.findMany({ orderBy: { ordem: 'asc' } });
  return linhas.map((a) => ({ id: a.id, nome: a.nome }));
}

export async function listarMateriaisDaArea(areaId: string): Promise<MaterialEstoque[]> {
  const linhas = await prisma.estoqueMaterial.findMany({ where: { areaId, excluidoEm: null }, orderBy: { nome: 'asc' } });
  return linhas.map((m) => ({
    id: m.id,
    nome: m.nome,
    unidade: m.unidade,
    fabricante: m.fabricante,
    quantidade: Number(m.quantidade),
    atualizadoEm: m.atualizadoEm.toISOString(),
  }));
}

export async function listarMovimentos(materialId: string, limite = 15): Promise<MovimentoEstoque[]> {
  const linhas = await prisma.estoqueMovimento.findMany({
    where: { materialId },
    orderBy: { criadoEm: 'desc' },
    take: limite,
  });
  return linhas.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    quantidade: Number(m.quantidade),
    saldoApos: Number(m.saldoApos),
    motivo: m.motivo,
    documento: m.documento,
    responsavel: m.responsavel,
    criadoEm: m.criadoEm.toISOString(),
  }));
}

export async function criarMaterialEstoque(v: {
  areaId: string;
  nome: string;
  unidade: string;
  fabricante: string | null;
  quantidadeInicial: number;
  responsavel: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const material = await tx.estoqueMaterial.create({
      data: {
        areaId: v.areaId,
        nome: v.nome,
        unidade: v.unidade,
        fabricante: v.fabricante,
        quantidade: v.quantidadeInicial,
      },
    });
    if (v.quantidadeInicial > 0) {
      await tx.estoqueMovimento.create({
        data: {
          materialId: material.id,
          tipo: 'ENTRADA',
          quantidade: v.quantidadeInicial,
          saldoApos: v.quantidadeInicial,
          motivo: 'Saldo inicial',
          responsavel: v.responsavel,
        },
      });
    }
  });
}

export type TipoMovimento = 'ENTRADA' | 'BAIXA' | 'AJUSTE';

/**
 * Entrada soma, baixa subtrai (não deixa o saldo ficar negativo) e ajuste põe o saldo
 * no valor contado. Tudo na mesma transação: o saldo e o histórico sempre batem.
 */
export async function registrarMovimentoEstoque(v: {
  materialId: string;
  tipo: TipoMovimento;
  quantidade: number;
  motivo: string | null;
  documento: string | null;
  responsavel: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const material = await tx.estoqueMaterial.findUnique({ where: { id: v.materialId } });
    if (!material) throw new Error('Material não encontrado.');
    const atual = Number(material.quantidade);

    let novo: number;
    let movimento: number;
    if (v.tipo === 'ENTRADA') {
      novo = atual + v.quantidade;
      movimento = v.quantidade;
    } else if (v.tipo === 'BAIXA') {
      if (v.quantidade > atual) throw new Error(`Saldo insuficiente: há ${atual} ${material.unidade} e a baixa é de ${v.quantidade}.`);
      novo = atual - v.quantidade;
      movimento = v.quantidade;
    } else {
      novo = v.quantidade;
      movimento = Math.abs(novo - atual);
    }

    await tx.estoqueMaterial.update({ where: { id: material.id }, data: { quantidade: novo } });
    await tx.estoqueMovimento.create({
      data: {
        materialId: material.id,
        tipo: v.tipo,
        quantidade: movimento,
        saldoApos: novo,
        motivo: v.motivo,
        documento: v.documento,
        responsavel: v.responsavel,
      },
    });
  });
}

/** Materiais apagados da área (lixeira), para restaurar. */
export async function listarMateriaisApagadosDaArea(areaId: string): Promise<MaterialEstoque[]> {
  const linhas = await prisma.estoqueMaterial.findMany({
    where: { areaId, excluidoEm: { not: null } },
    orderBy: { excluidoEm: 'desc' },
  });
  return linhas.map((m) => ({
    id: m.id,
    nome: m.nome,
    unidade: m.unidade,
    fabricante: m.fabricante,
    quantidade: Number(m.quantidade),
    atualizadoEm: m.atualizadoEm.toISOString(),
  }));
}

/** Manda o material para a lixeira. Só aceita com saldo zero, para não sumir com estoque. */
export async function apagarMaterialEstoque(materialId: string): Promise<void> {
  const material = await prisma.estoqueMaterial.findUnique({ where: { id: materialId } });
  if (!material) throw new Error('Material não encontrado.');
  if (Number(material.quantidade) !== 0) throw new Error('Zere o saldo antes de apagar o material.');
  await prisma.estoqueMaterial.update({ where: { id: materialId }, data: { excluidoEm: new Date() } });
}

/** Tira o material da lixeira e devolve para a lista da área. */
export async function restaurarMaterialEstoque(materialId: string): Promise<void> {
  await prisma.estoqueMaterial.update({ where: { id: materialId }, data: { excluidoEm: null } });
}
