'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { registrarAuditoria } from '@/lib/services/auditoria';

type Resultado = { ok: boolean; erro?: string };

/** Apaga de vez uma chegada lançada pela Portaria (cadastrada errado, duplicada). Só o dono. */
export async function apagarChegadaAction(id: string): Promise<Resultado> {
  const sessao = await requireAdmin();
  if (sessao.role !== 'DONO') return { ok: false, erro: 'Só o dono do sistema pode apagar dados da Portaria.' };
  try {
    const c = await prisma.chegadaCaminhao.delete({ where: { id } });
    await registrarAuditoria(sessao, 'Chegada da Portaria apagada', `${c.placaCarreta ?? c.placaCavalo ?? c.motoristaNome ?? 'sem identificação'} (${c.origem ?? 'sem origem'})`);
  } catch (e) {
    console.error('Falha ao apagar chegada', e);
    return { ok: false, erro: 'Não foi possível apagar. Nada foi alterado.' };
  }
  revalidatePath('/admin/portaria');
  revalidatePath('/portaria/recebimentos');
  return { ok: true };
}

/** Limpa o que a Portaria preencheu num remetido (motorista, placas, liberação, observação). Só o dono. */
export async function limparDadosPortariaAction(id: string): Promise<Resultado> {
  const sessao = await requireAdmin();
  if (sessao.role !== 'DONO') return { ok: false, erro: 'Só o dono do sistema pode apagar dados da Portaria.' };
  try {
    const m = await prisma.movimentacao.update({
      where: { id },
      data: {
        transportadora: null,
        motoristaNome: null,
        motoristaCpf: null,
        motoristaTelefone: null,
        placaCavalo: null,
        placaCarreta: null,
        capacidadeCarga: null,
        observacaoPortaria: null,
        carretaLiberadaEm: null,
        carretaLiberadaPor: null,
      },
    });
    await registrarAuditoria(sessao, 'Dados da Portaria apagados', `Remetido ${m.destino ?? m.id}: motorista, placas, liberação e observação da Portaria`);
  } catch (e) {
    console.error('Falha ao limpar dados da Portaria', e);
    return { ok: false, erro: 'Não foi possível apagar. Nada foi alterado.' };
  }
  revalidatePath('/admin/portaria');
  revalidatePath('/portaria');
  return { ok: true };
}
