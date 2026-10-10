import { prisma } from '@/lib/db';
import { verificarSegredo, criarSessao } from '@/lib/services/auth';
import { decifrar } from '@/lib/services/segredo2fa';
import { verificarTotp } from '@/lib/services/totp';

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

export interface ResultadoLogin {
  ok: boolean;
  token?: string;
  expiresAt?: Date;
  erro?: string;
  /** Senha correta, mas a conta exige o código de 2 etapas: ainda NÃO há sessão. */
  precisa2fa?: boolean;
  userId?: string;
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
  if (user.totpAtivo) {
    return { ok: false, precisa2fa: true, userId: user.id };
  }
  const { token, expiresAt } = await criarSessao(user.id);
  return { ok: true, token, expiresAt };
}

/**
 * Segunda etapa: confere o código do app autenticador. Mesmo bloqueio por tentativas
 * (5 erros = 15 min), em contador próprio por usuário. Cada código só vale uma vez.
 */
export async function concluirLoginComCodigo(userId: string, codigo: string): Promise<ResultadoLogin> {
  const chave = `2fa:${userId}`;
  const tentativa = await prisma.loginAttempt.findUnique({ where: { identificador: chave } });
  if (tentativa?.bloqueadoAte && tentativa.bloqueadoAte > new Date()) {
    return { ok: false, erro: 'Muitas tentativas. Tente novamente mais tarde.' };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  let passo: number | null = null;
  if (user?.totpAtivo && user.totpSecret) {
    try {
      passo = verificarTotp(decifrar(user.totpSecret), codigo, { ultimoPasso: user.totpUltimoPasso });
    } catch {
      passo = null;
    }
  }

  if (!user || passo === null) {
    const novas = (tentativa?.tentativas ?? 0) + 1;
    await prisma.loginAttempt.upsert({
      where: { identificador: chave },
      create: { identificador: chave, tentativas: 1 },
      update: {
        tentativas: novas,
        bloqueadoAte: novas >= MAX_TENTATIVAS ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000) : null,
      },
    });
    return { ok: false, erro: 'Código inválido ou já usado. Confira o app autenticador.' };
  }

  await prisma.loginAttempt.deleteMany({ where: { identificador: chave } });
  await prisma.user.update({ where: { id: user.id }, data: { totpUltimoPasso: passo } });
  const { token, expiresAt } = await criarSessao(user.id);
  return { ok: true, token, expiresAt };
}
