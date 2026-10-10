'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/services/requireAdmin';
import { verificarSegredo } from '@/lib/services/auth';
import { cifrar, decifrar, doisFatoresDisponivel } from '@/lib/services/segredo2fa';
import { gerarSegredoTotp, otpauthUri, verificarTotp } from '@/lib/services/totp';

export interface ResultadoSeguranca {
  ok: boolean;
  erro?: string;
  segredo?: string;
  uri?: string;
}

export async function iniciar2faAction(): Promise<ResultadoSeguranca> {
  const { userId } = await requireAdmin();
  if (!doisFatoresDisponivel()) {
    return { ok: false, erro: 'A verificação em duas etapas ainda não foi configurada no servidor (falta TOTP_ENC_KEY).' };
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.totpAtivo) return { ok: false, erro: 'A verificação em duas etapas já está ativa.' };

  const segredo = gerarSegredoTotp();
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: cifrar(segredo), totpUltimoPasso: null } });
  return { ok: true, segredo, uri: otpauthUri(segredo, user.username ?? user.email) };
}

export async function confirmar2faAction(codigo: string): Promise<ResultadoSeguranca> {
  const { userId } = await requireAdmin();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.totpAtivo || !user.totpSecret) return { ok: false, erro: 'Comece a ativação de novo.' };

  const passo = verificarTotp(decifrar(user.totpSecret), codigo);
  if (passo === null) return { ok: false, erro: 'Código incorreto. Confira o app e tente de novo.' };

  await prisma.user.update({ where: { id: userId }, data: { totpAtivo: true, totpUltimoPasso: passo } });
  revalidatePath('/admin/seguranca');
  return { ok: true };
}

export async function desativar2faAction(senha: string, codigo: string): Promise<ResultadoSeguranca> {
  const { userId } = await requireAdmin();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.totpAtivo || !user.totpSecret) return { ok: false, erro: 'A verificação em duas etapas não está ativa.' };

  if (!(await verificarSegredo(senha, user.senhaHash))) return { ok: false, erro: 'Senha incorreta.' };
  const passo = verificarTotp(decifrar(user.totpSecret), codigo, { ultimoPasso: user.totpUltimoPasso });
  if (passo === null) return { ok: false, erro: 'Código incorreto ou já usado.' };

  await prisma.user.update({ where: { id: userId }, data: { totpAtivo: false, totpSecret: null, totpUltimoPasso: null } });
  revalidatePath('/admin/seguranca');
  return { ok: true };
}
