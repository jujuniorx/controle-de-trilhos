import { prisma } from '@/lib/db';
import {
  AREA_TRILHOS,
  diaSP,
  precisaRepor,
  situacaoCalibracao,
  situacaoNivel,
  toneladasTrilho,
  metrosTrilho,
  type SituacaoCalibracao,
} from '@/lib/domain/estoque';
import type { PerfilTrilho } from '@prisma/client';

export const UNIDADES_MATERIAL = ['un', 'par', 'kg', 'L', 'm'] as const;

export interface AreaEstoque {
  id: string;
  nome: string;
}

export interface UltimoMovimento {
  tipo: string;
  quantidade: number;
  saldoApos: number;
  documento: string | null;
  motivo: string | null;
  responsavel: string;
  criadoEm: string;
}

export interface MaterialEstoque {
  id: string;
  areaId: string;
  nome: string;
  unidade: string;
  fabricante: string | null;
  quantidade: number;
  atualizadoEm: string;
  minimo: number | null;
  grupo: string | null;
  endereco: string | null;
  categoria: string | null;
  perfil: string | null;
  furos: number | null;
  comprimentoBarra: number | null;
  /** AAAA-MM-DD */
  calibradoEm: string | null;
  calibracaoValidade: string | null;
  capacidade: number | null;
  embalagem: string | null;
  /** Soma das baixas dos últimos 30 dias. */
  consumo30: number;
  ultimo: UltimoMovimento | null;
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

const num = (d: unknown) => (d == null ? null : Number(d));
const dia = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const DIA_MS = 24 * 60 * 60 * 1000;

type LinhaMaterial = Awaited<ReturnType<typeof prisma.estoqueMaterial.findMany>>[number];

function mapear(m: LinhaMaterial, consumo30 = 0, ultimo: UltimoMovimento | null = null): MaterialEstoque {
  return {
    id: m.id,
    areaId: m.areaId,
    nome: m.nome,
    unidade: m.unidade,
    fabricante: m.fabricante,
    quantidade: Number(m.quantidade),
    atualizadoEm: m.atualizadoEm.toISOString(),
    minimo: num(m.minimo),
    grupo: m.grupo,
    endereco: m.endereco,
    categoria: m.categoria,
    perfil: m.perfil,
    furos: m.furos,
    comprimentoBarra: num(m.comprimentoBarra),
    calibradoEm: dia(m.calibradoEm),
    calibracaoValidade: dia(m.calibracaoValidade),
    capacidade: num(m.capacidade),
    embalagem: m.embalagem,
    consumo30,
    ultimo,
  };
}

/** Consumo de 30 dias e último movimento de cada material, em duas consultas. */
async function completar(linhas: LinhaMaterial[]): Promise<MaterialEstoque[]> {
  if (linhas.length === 0) return [];
  const ids = linhas.map((m) => m.id);
  const [consumos, ultimos] = await Promise.all([
    prisma.estoqueMovimento.groupBy({
      by: ['materialId'],
      where: { materialId: { in: ids }, tipo: 'BAIXA', criadoEm: { gte: new Date(Date.now() - 30 * DIA_MS) } },
      _sum: { quantidade: true },
    }),
    prisma.estoqueMovimento.findMany({
      where: { materialId: { in: ids } },
      orderBy: { criadoEm: 'desc' },
      distinct: ['materialId'],
    }),
  ]);
  const consumo = new Map<string, number>(consumos.map((c) => [c.materialId, Number(c._sum.quantidade ?? 0)]));
  const ultimo = new Map<string, UltimoMovimento>(
    ultimos.map((u) => [
      u.materialId,
      {
        tipo: u.tipo,
        quantidade: Number(u.quantidade),
        saldoApos: Number(u.saldoApos),
        documento: u.documento,
        motivo: u.motivo,
        responsavel: u.responsavel,
        criadoEm: u.criadoEm.toISOString(),
      },
    ]),
  );
  return linhas.map((m) => mapear(m, consumo.get(m.id) ?? 0, ultimo.get(m.id) ?? null));
}

/** Áreas na ordem em que aparecem nas abas (Trilhos primeiro). */
export async function listarAreasEstoque(): Promise<AreaEstoque[]> {
  const linhas = await prisma.estoqueArea.findMany({ orderBy: { ordem: 'asc' } });
  return linhas.map((a) => ({ id: a.id, nome: a.nome }));
}

/** Fator de peso de cada perfil, em t/m (TR68 = 0,068). */
export async function fatoresPerfil(): Promise<Record<string, number>> {
  const linhas = await prisma.fatorPerfil.findMany();
  return Object.fromEntries(linhas.map((f) => [f.perfil, Number(f.fator)]));
}

export async function listarMateriaisDaArea(areaId: string, busca?: string): Promise<MaterialEstoque[]> {
  const termo = busca?.trim();
  const linhas = await prisma.estoqueMaterial.findMany({
    where: {
      areaId,
      excluidoEm: null,
      ...(termo
        ? {
            OR: [
              { nome: { contains: termo, mode: 'insensitive' } },
              { fabricante: { contains: termo, mode: 'insensitive' } },
              { grupo: { contains: termo, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ grupo: 'asc' }, { endereco: 'asc' }, { nome: 'asc' }],
  });
  return completar(linhas);
}

export async function buscarMaterial(id: string): Promise<(MaterialEstoque & { areaNome: string; excluido: boolean }) | null> {
  const m = await prisma.estoqueMaterial.findUnique({ where: { id }, include: { area: { select: { nome: true } } } });
  if (!m) return null;
  const [completo] = await completar([m]);
  return { ...completo, areaNome: m.area.nome, excluido: m.excluidoEm != null };
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

export interface MovimentoRecente extends MovimentoEstoque {
  materialId: string;
  material: string;
  unidade: string;
  categoria: string | null;
  areaId: string;
  area: string;
}

/** Últimas movimentações de uma área (ou de todas). */
export async function movimentosRecentes(areaId?: string, limite = 8): Promise<MovimentoRecente[]> {
  const linhas = await prisma.estoqueMovimento.findMany({
    where: areaId ? { material: { areaId } } : {},
    orderBy: { criadoEm: 'desc' },
    take: limite,
    include: { material: { select: { nome: true, unidade: true, categoria: true, areaId: true, area: { select: { nome: true } } } } },
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
    materialId: m.materialId,
    material: m.material.nome,
    unidade: m.material.unidade,
    categoria: m.material.categoria,
    areaId: m.material.areaId,
    area: m.material.area.nome,
  }));
}

/** Entradas e baixas de uma área nos últimos dias, e o material com mais baixas. */
export async function atividadeArea(areaId: string, dias = 7): Promise<{ entradas: number; baixas: number; maisRetirado: string | null; ultimaEntrada: { material: string; quando: string } | null }> {
  const desde = new Date(Date.now() - dias * DIA_MS);
  const [entradas, baixas, porMaterial, ultimaEntrada] = await Promise.all([
    prisma.estoqueMovimento.count({ where: { tipo: 'ENTRADA', criadoEm: { gte: desde }, material: { areaId } } }),
    prisma.estoqueMovimento.count({ where: { tipo: 'BAIXA', criadoEm: { gte: desde }, material: { areaId } } }),
    prisma.estoqueMovimento.groupBy({ by: ['materialId'], where: { tipo: 'BAIXA', criadoEm: { gte: desde }, material: { areaId } }, _count: { _all: true }, orderBy: { _count: { materialId: 'desc' } }, take: 1 }),
    prisma.estoqueMovimento.findFirst({ where: { tipo: 'ENTRADA', material: { areaId } }, orderBy: { criadoEm: 'desc' }, include: { material: { select: { nome: true } } } }),
  ]);
  const top = porMaterial[0] ? await prisma.estoqueMaterial.findUnique({ where: { id: porMaterial[0].materialId }, select: { nome: true } }) : null;
  return {
    entradas,
    baixas,
    maisRetirado: top?.nome ?? null,
    ultimaEntrada: ultimaEntrada ? { material: ultimaEntrada.material.nome, quando: ultimaEntrada.criadoEm.toISOString() } : null,
  };
}

export interface CamposMaterial {
  nome: string;
  unidade: string;
  fabricante: string | null;
  minimo: number | null;
  grupo: string | null;
  endereco: string | null;
  categoria: string | null;
  perfil: PerfilTrilho | null;
  furos: number | null;
  comprimentoBarra: number | null;
  calibradoEm: string | null;
  calibracaoValidade: string | null;
  capacidade: number | null;
  embalagem: string | null;
}

const dataBanco = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`) : null);

function paraBanco(c: CamposMaterial) {
  return { ...c, calibradoEm: dataBanco(c.calibradoEm), calibracaoValidade: dataBanco(c.calibracaoValidade) };
}

/** Item igual já cadastrado na área (mesmo nome e fabricante, sem contar maiúsculas). Para avisar antes de duplicar. */
export async function materialIgual(areaId: string, nome: string, fabricante: string | null): Promise<{ id: string; nome: string } | null> {
  const m = await prisma.estoqueMaterial.findFirst({
    where: {
      areaId,
      excluidoEm: null,
      nome: { equals: nome, mode: 'insensitive' },
      fabricante: fabricante ? { equals: fabricante, mode: 'insensitive' } : null,
    },
    select: { id: true, nome: true },
  });
  return m;
}

export async function criarMaterialEstoque(v: CamposMaterial & {
  areaId: string;
  quantidadeInicial: number;
  documento: string | null;
  responsavel: string;
}): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const { areaId, quantidadeInicial, documento, responsavel, ...campos } = v;
    const material = await tx.estoqueMaterial.create({
      data: { areaId, quantidade: quantidadeInicial, ...paraBanco(campos) },
    });
    if (quantidadeInicial > 0) {
      await tx.estoqueMovimento.create({
        data: {
          materialId: material.id,
          tipo: 'ENTRADA',
          quantidade: quantidadeInicial,
          saldoApos: quantidadeInicial,
          motivo: 'Saldo inicial',
          documento,
          responsavel,
        },
      });
    }
    return material.id;
  });
}

/** Muda os dados do material (não o saldo, que só muda por movimento). */
export async function atualizarMaterialEstoque(id: string, campos: CamposMaterial): Promise<void> {
  await prisma.estoqueMaterial.update({ where: { id }, data: paraBanco(campos) });
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
    if (material.excluidoEm) throw new Error('Este material está na lixeira. Restaure antes de movimentar.');
    const atual = Number(material.quantidade);

    let novo: number;
    let movimento: number;
    if (v.tipo === 'ENTRADA') {
      novo = atual + v.quantidade;
      movimento = v.quantidade;
    } else if (v.tipo === 'BAIXA') {
      if (v.quantidade > atual) throw new Error(`Saldo insuficiente: há ${atual.toLocaleString('pt-BR')} ${material.unidade} e a baixa é de ${v.quantidade.toLocaleString('pt-BR')}.`);
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

/** Metrologia: grava a calibração no material e deixa registrado no histórico (sem mexer no saldo). */
export async function registrarCalibracao(v: {
  materialId: string;
  calibradoEm: string;
  validade: string;
  documento: string | null;
  responsavel: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const material = await tx.estoqueMaterial.findUnique({ where: { id: v.materialId } });
    if (!material) throw new Error('Material não encontrado.');
    await tx.estoqueMaterial.update({
      where: { id: material.id },
      data: { calibradoEm: dataBanco(v.calibradoEm), calibracaoValidade: dataBanco(v.validade) },
    });
    const br = (d: string) => d.split('-').reverse().join('/');
    await tx.estoqueMovimento.create({
      data: {
        materialId: material.id,
        tipo: 'CALIBRACAO',
        quantidade: 0,
        saldoApos: material.quantidade,
        motivo: `Calibrado em ${br(v.calibradoEm)}, válido até ${br(v.validade)}`,
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
  return linhas.map((m) => mapear(m));
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

// ---------------------------------------------------------------------------------------------
// Resumo geral (aba Resumo)
// ---------------------------------------------------------------------------------------------

export interface AlertaEstoque {
  materialId: string;
  item: string;
  areaId: string;
  area: string;
  motivo: string;
  valor: string;
  /** vencida/zerado = vermelho; o resto = amarelo. */
  grave: boolean;
}

export interface ResumoAreaEstoque {
  id: string;
  nome: string;
  materiais: MaterialEstoque[];
  abaixo: number;
  baixas7d: number;
  entradas7d: number;
  calibracao: { vencidas: number; vencendo: number };
}

export interface DiaMovimento {
  dia: string;
  entradas: number;
  baixas: number;
}

export interface ResumoGeralEstoque {
  areas: ResumoAreaEstoque[];
  alertas: AlertaEstoque[];
  semana: DiaMovimento[];
  ultimas: MovimentoRecente[];
  fatores: Record<string, number>;
  totais: { itens: number; abaixo: number; vencidas: number; vencendo: number; entradas7d: number; baixas7d: number };
  trilhos: { toneladas: number; metros: number };
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const mesAno = (d: string) => `${d.slice(5, 7)}/${d.slice(0, 4)}`;

export async function resumoGeralEstoque(agora = new Date()): Promise<ResumoGeralEstoque> {
  const hoje = diaSP(agora);
  const inicioSemana = new Date(agora.getTime() - 6 * DIA_MS);
  const [areas, linhas, movs, ultimas, fatores] = await Promise.all([
    prisma.estoqueArea.findMany({ orderBy: { ordem: 'asc' } }),
    prisma.estoqueMaterial.findMany({ where: { excluidoEm: null }, orderBy: [{ grupo: 'asc' }, { nome: 'asc' }] }),
    prisma.estoqueMovimento.findMany({
      // Folga de um dia para pegar o começo do primeiro dia no fuso de São Paulo.
      where: { criadoEm: { gte: new Date(inicioSemana.getTime() - DIA_MS) }, tipo: { in: ['ENTRADA', 'BAIXA'] } },
      select: { tipo: true, criadoEm: true, material: { select: { areaId: true } } },
    }),
    movimentosRecentes(undefined, 8),
    fatoresPerfil(),
  ]);
  const materiais = await completar(linhas);

  const dias: DiaMovimento[] = [];
  for (let i = 6; i >= 0; i--) dias.push({ dia: diaSP(new Date(agora.getTime() - i * DIA_MS)), entradas: 0, baixas: 0 });
  const porArea = new Map<string, { entradas: number; baixas: number }>();
  for (const m of movs) {
    const d = dias.find((x) => x.dia === diaSP(m.criadoEm));
    if (!d) continue;
    const a = porArea.get(m.material.areaId) ?? { entradas: 0, baixas: 0 };
    if (m.tipo === 'ENTRADA') { d.entradas += 1; a.entradas += 1; } else { d.baixas += 1; a.baixas += 1; }
    porArea.set(m.material.areaId, a);
  }

  const alertas: AlertaEstoque[] = [];
  const nomeArea = new Map<string, string>(areas.map((a) => [a.id, a.nome] as [string, string]));
  for (const m of materiais) {
    const area = nomeArea.get(m.areaId) ?? '';
    const n = situacaoNivel(m.quantidade, m.minimo);
    if (precisaRepor(n) && (m.minimo ?? 0) > 0) {
      alertas.push({ materialId: m.id, item: m.nome, areaId: m.areaId, area, motivo: `mínimo ${fmt(m.minimo ?? 0)} ${m.unidade}`, valor: `${fmt(m.quantidade)} ${m.unidade}`, grave: n === 'zerado' });
    }
    const c: SituacaoCalibracao = situacaoCalibracao(m.calibracaoValidade, hoje);
    if (c === 'vencida' || c === 'vence') {
      alertas.push({
        materialId: m.id, item: m.nome, areaId: m.areaId, area,
        motivo: c === 'vencida' ? `calibração vencida em ${mesAno(m.calibracaoValidade!)}` : `calibração vence em ${m.calibracaoValidade!.split('-').reverse().join('/')}`,
        valor: c === 'vencida' ? 'vencida' : 'vence logo',
        grave: c === 'vencida',
      });
    }
  }
  alertas.sort((a, b) => Number(b.grave) - Number(a.grave));

  const resumoAreas: ResumoAreaEstoque[] = areas.map((a) => {
    const lista = materiais.filter((m) => m.areaId === a.id);
    const atv = porArea.get(a.id) ?? { entradas: 0, baixas: 0 };
    const cal = lista.map((m) => situacaoCalibracao(m.calibracaoValidade, hoje));
    return {
      id: a.id,
      nome: a.nome,
      materiais: lista,
      abaixo: lista.filter((m) => precisaRepor(situacaoNivel(m.quantidade, m.minimo)) && (m.minimo ?? 0) > 0).length,
      entradas7d: atv.entradas,
      baixas7d: atv.baixas,
      calibracao: { vencidas: cal.filter((c) => c === 'vencida').length, vencendo: cal.filter((c) => c === 'vence').length },
    };
  });

  const trilhos = materiais.filter((m) => m.areaId === AREA_TRILHOS);
  const toneladas = trilhos.reduce((t, m) => t + (toneladasTrilho({ ...m, fator: m.perfil ? fatores[m.perfil] ?? null : null }) ?? 0), 0);
  const metros = trilhos.reduce((t, m) => t + (metrosTrilho(m) ?? 0), 0);

  return {
    areas: resumoAreas,
    alertas,
    semana: dias,
    ultimas,
    fatores,
    totais: {
      itens: materiais.length,
      abaixo: resumoAreas.reduce((t, a) => t + a.abaixo, 0),
      vencidas: resumoAreas.reduce((t, a) => t + a.calibracao.vencidas, 0),
      vencendo: resumoAreas.reduce((t, a) => t + a.calibracao.vencendo, 0),
      entradas7d: dias.reduce((t, d) => t + d.entradas, 0),
      baixas7d: dias.reduce((t, d) => t + d.baixas, 0),
    },
    trilhos: { toneladas, metros },
  };
}
