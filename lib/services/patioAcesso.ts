import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { verificarSegredo } from '@/lib/services/auth';

export async function verificarPin(pinInformado: string): Promise<boolean> {
  const hashConfigurado = process.env.PATIO_PIN_HASH;
  if (!hashConfigurado) throw new Error('PATIO_PIN_HASH não configurado');
  return verificarSegredo(pinInformado, hashConfigurado);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function criarAcessoPatio(): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);
  await prisma.patioAcessoToken.create({ data: { tokenHash: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

export async function validarAcessoPatio(token: string): Promise<boolean> {
  const registro = await prisma.patioAcessoToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!registro || registro.revokedAt || registro.expiresAt < new Date()) return false;
  return true;
}
