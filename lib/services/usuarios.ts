import { prisma } from '@/lib/db';
import { hashSegredo } from '@/lib/services/auth';
import { ErroRegraNegocio } from '@/lib/services/errors';
import type { NovoUsuarioInput } from '@/lib/validation/usuario';

export function listarUsuarios() {
  return prisma.user.findMany({
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    select: { id: true, nome: true, username: true, email: true, role: true, ativo: true, ultimoLoginEm: true },
  });
}

export async function criarUsuario(dados: NovoUsuarioInput): Promise<{ id: string; nome: string }> {
  const email = `${dados.username}@controle-trilhos.local`;
  const existente = await prisma.user.findFirst({
    where: { OR: [{ username: { equals: dados.username, mode: 'insensitive' } }, { email }] },
  });
  if (existente) throw new ErroRegraNegocio('Já existe uma conta com esse usuário.');
  const user = await prisma.user.create({
    data: { nome: dados.nome, username: dados.username, email, senhaHash: await hashSegredo(dados.senha) },
  });
  return { id: user.id, nome: user.nome };
}

async function revogarTodasSessoes(userId: string) {
  await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function alterarAtivo(userId: string, ativo: boolean, atorId: string): Promise<{ nome: string }> {
  if (userId === atorId && !ativo) throw new ErroRegraNegocio('Você não pode desativar a própria conta.');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ErroRegraNegocio('Usuário não encontrado.');
  if (!ativo && user.role === 'DONO') throw new ErroRegraNegocio('A conta do dono não pode ser desativada.');
  await prisma.user.update({ where: { id: userId }, data: { ativo } });
  if (!ativo) await revogarTodasSessoes(userId);
  return { nome: user.nome };
}

/** Define uma senha nova (a pessoa pode trocar depois em "Trocar minha senha"). Derruba as sessões abertas. */
export async function redefinirSenha(userId: string, novaSenha: string): Promise<{ nome: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ErroRegraNegocio('Usuário não encontrado.');
  await prisma.user.update({ where: { id: userId }, data: { senhaHash: await hashSegredo(novaSenha) } });
  await prisma.loginAttempt.deleteMany({
    where: { identificador: { in: [user.email.toLowerCase(), (user.username ?? '').toLowerCase()] } },
  });
  await revogarTodasSessoes(userId);
  return { nome: user.nome };
}
