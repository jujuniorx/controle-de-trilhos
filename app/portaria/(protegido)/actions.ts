'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { revogarSessao } from '@/lib/services/auth';
import { requirePortaria } from '@/lib/services/requirePortaria';
import { liberarCarreta, salvarDadosPortaria } from '@/lib/services/portaria';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { dadosPortariaSchema } from '@/lib/validation/portaria';

export interface ResultadoPortaria {
  ok: boolean;
  mensagem?: string;
  erro?: string;
}

export async function sairPortariaAction(): Promise<void> {
  const jar = await cookies();
  const token = jar.get('sessao_admin')?.value;
  if (token) {
    try {
      await revogarSessao(token);
    } catch {
      /* mesmo se falhar, o cookie sai */
    }
  }
  jar.delete('sessao_admin');
  redirect('/portaria/login');
}

async function processar(id: string, entrada: unknown, liberar: boolean): Promise<ResultadoPortaria> {
  // Server actions são endpoints públicos: a sessão é conferida aqui, não só na tela.
  const ator = await requirePortaria();
  const parsed = dadosPortariaSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  try {
    if (liberar) await liberarCarreta(id, parsed.data, ator.nome, ator.userId);
    else await salvarDadosPortaria(id, parsed.data, ator.nome, ator.userId);
    revalidatePath('/portaria');
    revalidatePath('/patio/remetidos');
    return { ok: true, mensagem: liberar ? 'Carreta liberada! O Pátio foi avisado.' : 'Dados salvos.' };
  } catch (e) {
    if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
    console.error('[portaria] falha', e);
    return { ok: false, erro: 'Não foi possível concluir. Tente de novo.' };
  }
}

export async function salvarDadosAction(id: string, entrada: unknown): Promise<ResultadoPortaria> {
  return processar(id, entrada, false);
}

export async function liberarCarretaAction(id: string, entrada: unknown): Promise<ResultadoPortaria> {
  return processar(id, entrada, true);
}
