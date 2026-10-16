'use server';

import { revalidatePath } from 'next/cache';
import { requirePortaria } from '@/lib/services/requirePortaria';
import { cancelarChegada, confirmarSaidaChegada, criarChegada, definirOrdemChegada, liberarChegada, salvarDadosChegada } from '@/lib/services/chegada';
import { ErroRegraNegocio } from '@/lib/services/errors';
import { dadosChegadaSchema } from '@/lib/validation/chegada';
import type { ResultadoPortaria } from '../actions';

function erro(e: unknown): ResultadoPortaria {
  if (e instanceof ErroRegraNegocio) return { ok: false, erro: e.message };
  console.error('[portaria/recebimentos] falha', e);
  return { ok: false, erro: 'Não foi possível concluir. Tente de novo.' };
}

function atualizarTelas() {
  revalidatePath('/portaria/recebimentos');
  revalidatePath('/patio');
}

// Server actions são endpoints públicos: a sessão é conferida aqui, não só na tela.
export async function novaChegadaAction(): Promise<ResultadoPortaria> {
  const ator = await requirePortaria();
  try {
    await criarChegada(ator.nome);
    atualizarTelas();
    return { ok: true, mensagem: 'Chegada cadastrada.' };
  } catch (e) {
    return erro(e);
  }
}

async function comDados(entrada: unknown, fn: (dados: ReturnType<typeof dadosChegadaSchema.parse>, nome: string) => Promise<string>): Promise<ResultadoPortaria> {
  const ator = await requirePortaria();
  const parsed = dadosChegadaSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  try {
    const mensagem = await fn(parsed.data, ator.nome);
    atualizarTelas();
    return { ok: true, mensagem };
  } catch (e) {
    return erro(e);
  }
}

export async function salvarChegadaAction(id: string, entrada: unknown): Promise<ResultadoPortaria> {
  return comDados(entrada, async (d) => {
    await salvarDadosChegada(id, d);
    return 'Dados salvos.';
  });
}

export async function registrarChegadaAction(id: string, entrada: unknown): Promise<ResultadoPortaria> {
  return comDados(entrada, async (d, nome) => {
    await liberarChegada(id, d, nome);
    return 'Chegada registrada! O Pátio foi avisado.';
  });
}

export async function cancelarChegadaAction(id: string): Promise<ResultadoPortaria> {
  await requirePortaria();
  try {
    await cancelarChegada(id);
    atualizarTelas();
    return { ok: true, mensagem: 'Chegada cancelada.' };
  } catch (e) {
    return erro(e);
  }
}

export async function confirmarSaidaChegadaAction(id: string): Promise<ResultadoPortaria> {
  const ator = await requirePortaria();
  try {
    await confirmarSaidaChegada(id, ator.nome);
    atualizarTelas();
    return { ok: true, mensagem: 'Saída confirmada.' };
  } catch (e) {
    return erro(e);
  }
}

/** Portaria: troca o número de ordem do caminhão (Caminhão 1, 2...). O Pátio vê a mesma ordem. */
export async function definirOrdemChegadaAction(id: string, ordem: number): Promise<ResultadoPortaria> {
  await requirePortaria();
  try {
    await definirOrdemChegada(id, ordem);
    atualizarTelas();
    return { ok: true, mensagem: `Caminhão nº ${ordem}.` };
  } catch (e) {
    return erro(e);
  }
}
