import argon2 from 'argon2';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

export async function hashSegredo(valor: string): Promise<string> {
  return argon2.hash(valor);
}

/**
 * Nunca deixa um erro do argon2 (ex.: hash mal configurado/corrompido no
 * ambiente) vazar como exceção não tratada — isso derrubaria a Server Action
 * antes mesmo de registrar a tentativa no controle de força bruta. Falha
 * fechado: hash inválido é tratado como "não bate", nunca como sucesso.
 */
export async function verificarSegredo(valor: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, valor);
  } catch {
    return false;
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function criarSessao(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

export async function validarSessao(
  token: string,
): Promise<{ userId: string; nome: string; role: 'ADMIN' | 'DONO' } | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { nome: true, role: true, ativo: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (!session.user.ativo) return null; // conta desativada perde o acesso na hora
  return { userId: session.userId, nome: session.user.nome, role: session.user.role };
}

export async function revogarSessao(token: string): Promise<void> {
  await prisma.session.updateMany({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } });
}

/**
 * Troca a senha de um usuário já autenticado (Bloco 3) — exige a senha atual
 * (reautenticação), nunca loga senha/hash. Erros são mensagens genéricas de
 * propósito (não revelam se o usuário existe) — mas aqui o userId já vem de
 * uma sessão válida (requireAdmin), então o único jeito de "senhaAtual errada"
 * é o próprio usuário ter digitado errado.
 */
export async function trocarSenha(
  userId: string,
  senhaAtual: string,
  novaSenha: string,
): Promise<{ ok: boolean; erro?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, erro: 'Usuário não encontrado.' };

  const senhaAtualValida = await verificarSegredo(senhaAtual, user.senhaHash);
  if (!senhaAtualValida) return { ok: false, erro: 'Senha atual incorreta.' };

  await prisma.user.update({ where: { id: userId }, data: { senhaHash: await hashSegredo(novaSenha) } });
  return { ok: true };
}
