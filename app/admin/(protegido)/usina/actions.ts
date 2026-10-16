'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { salvarEstaleiroDia, salvarEstoqueTls, salvarManutencaoSemana, salvarEscalaSemana, TIPOS_TLS, type TipoTlsValor } from '@/lib/services/usina';
import { ehIsoValido } from '@/lib/usina/periodo';

export interface ResultadoUsina {
  ok: boolean;
  erro?: string;
}

/** Número inteiro não negativo, ou null quando o campo ficou em branco. */
function inteiro(v: FormDataEntryValue | null): number | null | 'invalido' {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  if (!/^\d{1,6}$/.test(s)) return 'invalido';
  return Number(s);
}

function dataDoForm(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '');
  return ehIsoValido(s) ? s : null;
}

function atualizar() {
  revalidatePath('/admin/usina');
}

export async function salvarEstaleiroAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const data = dataDoForm(formData.get('data'));
  if (!data) return { ok: false, erro: 'Data inválida.' };
  const soldas = inteiro(formData.get('soldas'));
  const cortes = inteiro(formData.get('cortes'));
  if (soldas === 'invalido' || cortes === 'invalido') return { ok: false, erro: 'Use só números inteiros em soldas e cortes.' };
  await salvarEstaleiroDia(data, soldas, cortes);
  atualizar();
  return { ok: true };
}

export async function salvarEstoqueTlsAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const data = dataDoForm(formData.get('data'));
  if (!data) return { ok: false, erro: 'Data inválida.' };
  const valores: Partial<Record<TipoTlsValor, number | null>> = {};
  for (const tipo of TIPOS_TLS) {
    const q = inteiro(formData.get(`tls_${tipo}`));
    if (q === 'invalido') return { ok: false, erro: 'Use só números inteiros no estoque de TLS.' };
    valores[tipo] = q;
  }
  await salvarEstoqueTls(data, valores);
  atualizar();
  return { ok: true };
}

export async function salvarManutencaoAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const semana = dataDoForm(formData.get('semana'));
  const dia = dataDoForm(formData.get('diaManutencao'));
  if (!semana || !dia) return { ok: false, erro: 'Informe a semana e o dia da manutenção.' };
  await salvarManutencaoSemana(semana, dia);
  atualizar();
  return { ok: true };
}

export async function salvarEscalaAction(_: ResultadoUsina | undefined, formData: FormData): Promise<ResultadoUsina> {
  await requireAdmin();
  const semana = dataDoForm(formData.get('semana'));
  if (!semana) return { ok: false, erro: 'Semana inválida.' };
  await salvarEscalaSemana(semana, String(formData.get('conteudo') ?? '').slice(0, 5000));
  atualizar();
  return { ok: true };
}
