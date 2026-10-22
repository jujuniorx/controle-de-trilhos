'use server';

import { requireDono } from '@/lib/services/requireAdmin';
import {
  criarPilhaPatio,
  removerPilhaPatio,
  salvarPilhaPatio,
  type DadosPilhaPatio,
  type PilhaPatio,
} from '@/lib/services/pilhasPatio';

export type ResultadoPilha = { ok: true; pilha?: PilhaPatio } | { ok: false; erro: string };

export async function criarPilhaAction(): Promise<ResultadoPilha> {
  await requireDono();
  try {
    return { ok: true, pilha: await criarPilhaPatio() };
  } catch {
    return { ok: false, erro: 'Não consegui criar a pilha. Tente de novo.' };
  }
}

export async function salvarPilhaAction(id: string, dados: DadosPilhaPatio): Promise<ResultadoPilha> {
  await requireDono();
  try {
    await salvarPilhaPatio(id, dados);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Não consegui salvar. Tente de novo.' };
  }
}

export async function removerPilhaAction(id: string): Promise<ResultadoPilha> {
  await requireDono();
  try {
    await removerPilhaPatio(id);
    return { ok: true };
  } catch {
    return { ok: false, erro: 'Não consegui remover. Tente de novo.' };
  }
}
