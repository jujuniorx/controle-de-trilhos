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

/**
 * Login por usuário OU e-mail no mesmo campo (Bloco 3) — a conta de teste
 * original só tem e-mail; contas novas têm username. Identificador normalizado
 * em minúsculas: e-mails já eram case-insensitive na prática (ninguém digita
 * domínio em caixa alta de propósito) e usernames nascem em minúsculas pelo
 * script de criação, então comparar em minúsculas nunca rejeita um login
 * válido e evita o usuário "Paula" não bater com "paula".
 */
export async function autenticar(identificador: string, senha: string): Promise<ResultadoLogin> {
  const chave = identificador.trim().toLowerCase();
  const tentativa = await prisma.loginAttempt.findUnique({ where: { identificador: chave } });
  if (tentativa?.bloqueadoAte && tentativa.bloqueadoAte > new Date()) {
    return { ok: false, erro: 'Conta temporariamente bloqueada. Tente novamente mais tarde.' };
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: { equals: chave, mode: 'insensitive' } }, { username: { equals: chave, mode: 'insensitive' } }] },
  });
  const senhaValida = user ? await verificarSegredo(senha, user.senhaHash) : false;

  if (!user || !senhaValida) {
    const novasTentativas = (tentativa?.tentativas ?? 0) + 1;
    await prisma.loginAttempt.upsert({
      where: { identificador: chave },
      create: { identificador: chave, tentativas: 1 },
      update: {
        tentativas: novasTentativas,
        bloqueadoAte: novasTentativas >= MAX_TENTATIVAS ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000) : null,
      },
    });
    return { ok: false, erro: 'Usuário/e-mail ou senha inválidos.' };
  }

  await prisma.loginAttempt.deleteMany({ where: { identificador: chave } });
  const { token, expiresAt } = await criarSessao(user.id);
  return { ok: true, token, expiresAt };
}
