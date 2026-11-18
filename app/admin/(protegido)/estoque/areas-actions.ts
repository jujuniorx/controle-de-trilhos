'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import {
  criarMaterialEstoque,
  registrarMovimentoEstoque,
  UNIDADES_MATERIAL,
  type TipoMovimento,
} from '@/lib/services/estoqueAreas';
import type { ResultadoFormUsina } from '@/components/usina/FormularioUsina';

function texto(v: FormDataEntryValue | null, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

/** Quantidade com vírgula ou ponto. Vazio vira zero; negativo ou inválido é recusado. */
function quantidade(v: FormDataEntryValue | null): number | 'invalido' {
  const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.');
  if (s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : 'invalido';
}

/** Cadastra um material numa área, com saldo inicial opcional. */
export async function criarMaterialEstoqueAction(_: ResultadoFormUsina | undefined, formData: FormData): Promise<ResultadoFormUsina> {
  const { nome: responsavel } = await requireAdmin();
  const areaId = texto(formData.get('areaId'), 60);
  const nome = texto(formData.get('nome'), 80);
  const unidade = texto(formData.get('unidade'), 5);
  if (!areaId) return { ok: false, erro: 'Área não informada.' };
  if (!nome) return { ok: false, erro: 'Informe o nome do material.' };
  if (!(UNIDADES_MATERIAL as readonly string[]).includes(unidade)) return { ok: false, erro: 'Escolha a unidade (un, par, kg, L ou m).' };
  const q = quantidade(formData.get('quantidadeInicial'));
  if (q === 'invalido') return { ok: false, erro: 'Use só números positivos na quantidade inicial.' };
  await criarMaterialEstoque({
    areaId,
    nome,
    unidade,
    fabricante: texto(formData.get('fabricante'), 80) || null,
    quantidadeInicial: q,
    responsavel,
  });
  revalidatePath('/admin/estoque');
  return { ok: true };
}

/** Registra entrada, baixa ou ajuste de um material. Quem registra fica no histórico. */
export async function registrarMovimentoEstoqueAction(_: ResultadoFormUsina | undefined, formData: FormData): Promise<ResultadoFormUsina> {
  const { nome: responsavel } = await requireAdmin();
  const materialId = texto(formData.get('materialId'), 60);
  const tipo = texto(formData.get('tipo'), 10) as TipoMovimento;
  if (!materialId) return { ok: false, erro: 'Material não informado.' };
  if (!['ENTRADA', 'BAIXA', 'AJUSTE'].includes(tipo)) return { ok: false, erro: 'Tipo de movimento inválido.' };
  const q = quantidade(formData.get('quantidade'));
  if (q === 'invalido') return { ok: false, erro: 'Use só números positivos na quantidade.' };
  const motivo = texto(formData.get('motivo'), 160) || null;
  if (tipo === 'BAIXA' && !motivo) return { ok: false, erro: 'Informe o motivo da baixa (ex.: retirado para corte).' };
  if (tipo === 'AJUSTE' && !motivo) return { ok: false, erro: 'No ajuste, informe o motivo (ex.: diferença na contagem).' };
  try {
    await registrarMovimentoEstoque({
      materialId,
      tipo,
      quantidade: q,
      motivo,
      documento: texto(formData.get('documento'), 40) || null,
      responsavel,
    });
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não foi possível registrar.' };
  }
  revalidatePath('/admin/estoque');
  return { ok: true };
}
