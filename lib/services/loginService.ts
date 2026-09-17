import { prisma } from '@/lib/db';
import { verificarSegredo, criarSessao } from '@/lib/services/auth';

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

export interface ResultadoLogin {
  ok: boolean;
  token?: string;
  expiresAt?: Date;
  erro?: string;
}

export async function autenticar(email: string, senha: string): Promise<ResultadoLogin> {
  const tentativa = await prisma.loginAttempt.findUnique({ where: { identificador: email } });
  if (tentativa?.bloqueadoAte && tentativa.bloqueadoAte > new Date()) {
    return { ok: false, erro: 'Conta temporariamente bloqueada. Tente novamente mais tarde.' };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const senhaValida = user ? await verificarSegredo(senha, user.senhaHash) : false;

  if (!user || !senhaValida) {
    const novasTentativas = (tentativa?.tentativas ?? 0) + 1;
    await prisma.loginAttempt.upsert({
      where: { identificador: email },
      create: { identificador: email, tentativas: 1 },
      update: {
        tentativas: novasTentativas,
        bloqueadoAte: novasTentativas >= MAX_TENTATIVAS ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000) : null,
      },
    });
    return { ok: false, erro: 'E-mail ou senha inválidos.' };
  }

  await prisma.loginAttempt.deleteMany({ where: { identificador: email } });
  const { token, expiresAt } = await criarSessao(user.id);
  return { ok: true, token, expiresAt };
}
