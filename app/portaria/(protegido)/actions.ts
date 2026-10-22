'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { revogarSessao } from '@/lib/services/auth';
import { requirePortaria } from '@/lib/services/requirePortaria';
import { apagarCarretaPelaPortaria, confirmarSaidaCarreta, criarEnvioPelaPortaria, desfazerSaidaCarreta, registrarChegadaCarreta, salvarDadosPortaria } from '@/lib/services/portaria';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { dadosPortariaSchema, novoEnvioPortariaSchema } from '@/lib/validation/portaria';

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

async function processar(id: string, entrada: unknown, registrarChegada: boolean): Promise<ResultadoPortaria> {
  // Server actions são endpoints públicos: a sessão é conferida aqui, não só na tela.
  const ator = await requirePortaria();
  const parsed = dadosPortariaSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  try {
    if (registrarChegada) await registrarChegadaCarreta(id, parsed.data, ator.nome, ator.userId);
    else await salvarDadosPortaria(id, parsed.data, ator.nome, ator.userId);
    revalidatePath('/portaria');
    revalidatePath('/patio/remetidos');
    revalidatePath('/patio');
    return { ok: true, mensagem: registrarChegada ? 'Chegada registrada! O Pátio foi avisado.' : 'Dados salvos.' };
  } catch (e) {
    if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
    console.error('[portaria] falha', e);
    return { ok: false, erro: 'Não foi possível concluir. Tente de novo.' };
  }
}

export async function salvarDadosAction(id: string, entrada: unknown): Promise<ResultadoPortaria> {
  return processar(id, entrada, false);
}

export async function registrarChegadaAction(id: string, entrada: unknown): Promise<ResultadoPortaria> {
  return processar(id, entrada, true);
}

/** Portaria: apaga a carreta que chegou e ainda não foi liberada pelo Pátio. */
export async function apagarCarretaAction(id: string): Promise<ResultadoPortaria> {
  const ator = await requirePortaria();
  try {
    await apagarCarretaPelaPortaria(id, { userId: ator.userId, nome: ator.nome });
    revalidatePath('/portaria');
    revalidatePath('/patio');
    revalidatePath('/patio/remetidos');
    return { ok: true, mensagem: 'Carreta apagada.' };
  } catch (e) {
    if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
    console.error('[portaria] falha ao apagar carreta', e);
    return { ok: false, erro: 'Não foi possível apagar. Nada foi alterado.' };
  }
}

export async function confirmarSaidaAction(id: string): Promise<ResultadoPortaria> {
  const ator = await requirePortaria();
  try {
    await confirmarSaidaCarreta(id, ator.nome, ator.userId);
    revalidatePath('/portaria');
    revalidatePath('/patio/remetidos');
    return { ok: true, mensagem: 'Saída confirmada.' };
  } catch (e) {
    if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
    console.error('[portaria] falha ao confirmar saída', e);
    return { ok: false, erro: 'Não foi possível concluir. Tente de novo.' };
  }
}

/** Carreta que chegou sem aviso do Pátio: a Portaria cria o envio já com a chegada registrada. */
export async function novoEnvioPortariaAction(entrada: unknown): Promise<ResultadoPortaria> {
  const ator = await requirePortaria();
  const parsed = novoEnvioPortariaSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  try {
    await criarEnvioPelaPortaria(parsed.data, ator.nome, ator.userId);
    revalidatePath('/portaria');
    revalidatePath('/patio/remetidos');
    revalidatePath('/patio');
    return { ok: true, mensagem: 'Envio criado e Pátio avisado!' };
  } catch (e) {
    if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
    console.error('[portaria] falha ao criar envio', e);
    return { ok: false, erro: 'Não foi possível concluir. Tente de novo.' };
  }
}

/** Portaria: desfaz a saída registrada por engano. */
export async function desfazerSaidaAction(id: string): Promise<ResultadoPortaria> {
  const ator = await requirePortaria();
  try {
    await desfazerSaidaCarreta(id, ator.nome, ator.userId);
    revalidatePath('/portaria');
    revalidatePath('/patio/remetidos');
    return { ok: true, mensagem: 'Saída desfeita. A carreta voltou para a portaria.' };
  } catch (e) {
    if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
    console.error('[portaria] falha ao desfazer saída', e);
    return { ok: false, erro: 'Não foi possível concluir. Tente de novo.' };
  }
}
