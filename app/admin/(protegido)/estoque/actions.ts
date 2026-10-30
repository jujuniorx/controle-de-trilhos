'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { salvarItemEstoque, excluirItemEstoque, TIPOS_ESTOQUE, type TipoEstoque } from '@/lib/services/estoque';
import type { ResultadoFormUsina } from '@/components/usina/FormularioUsina';

function texto(v: FormDataEntryValue | null, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

/** Quantidade: aceita vírgula ou ponto. Vazio vira zero. Negativo ou inválido é recusado. */
function quantidade(v: FormDataEntryValue | null): number | 'invalido' {
  const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.');
  if (s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 'invalido';
}

/** Cria ou atualiza um item do estoque. Só o Administrativo altera. */
export async function salvarItemEstoqueAction(_: ResultadoFormUsina | undefined, formData: FormData): Promise<ResultadoFormUsina> {
  await requireAdmin();
  const tipo = String(formData.get('tipo') ?? '') as TipoEstoque;
  if (!TIPOS_ESTOQUE.includes(tipo)) return { ok: false, erro: 'Tipo inválido.' };
  const nome = texto(formData.get('nome'), 80);
  if (!nome) return { ok: false, erro: 'Informe o nome do item (ex.: TR68, Tala 6 furos).' };
  const t = quantidade(formData.get('quantidadeT'));
  const m = quantidade(formData.get('quantidadeM'));
  if (t === 'invalido' || m === 'invalido') return { ok: false, erro: 'Use só números positivos nas quantidades.' };
  const id = texto(formData.get('id'), 40) || undefined;
  await salvarItemEstoque({
    id,
    tipo,
    nome,
    fabricante: texto(formData.get('fabricante'), 80) || null,
    quantidadeT: t,
    quantidadeM: m,
  });
  revalidatePath('/admin/estoque');
  return { ok: true };
}

/** Remove um item do estoque (só o Administrativo). */
export async function excluirItemEstoqueAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = texto(formData.get('id'), 40);
  if (id) await excluirItemEstoque(id);
  revalidatePath('/admin/estoque');
}
