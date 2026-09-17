import argon2 from 'argon2';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

export async function hashSegredo(valor: string): Promise<string> {
  return argon2.hash(valor);
}

export async function verificarSegredo(valor: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, valor);
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

export async function validarSessao(token: string): Promise<{ userId: string } | null> {
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  return { userId: session.userId };
}

export async function revogarSessao(token: string): Promise<void> {
  await prisma.session.updateMany({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } });
}
