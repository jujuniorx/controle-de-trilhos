import { prisma } from '@/lib/db';
import { verificarSegredo, criarSessao, gastarTempoDeVerificacao } from '@/lib/services/auth';

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
const TETO_GLOBAL = 20; // tentativas erradas por usuário, vindas de qualquer computador

export async function autenticar(identificador: string, senha: string, ip = 'desconhecido'): Promise<ResultadoLogin> {
  const chave = identificador.trim().toLowerCase();
  // Bloqueio por usuário E computador: quem erra a senha só trava a própria tentativa, não a conta de todos.
  const chaveIp = `${chave}@${ip}`;
  const tentativa = await prisma.loginAttempt.findUnique({ where: { identificador: chaveIp } });
  const global = await prisma.loginAttempt.findUnique({ where: { identificador: chave } });
  const agora = new Date();
  if ((tentativa?.bloqueadoAte && tentativa.bloqueadoAte > agora) || (global?.bloqueadoAte && global.bloqueadoAte > agora)) {
    return { ok: false, erro: 'Conta temporariamente bloqueada. Tente novamente mais tarde.' };
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: { equals: chave, mode: 'insensitive' } }, { username: { equals: chave, mode: 'insensitive' } }] },
  });
  const senhaValida = user ? await verificarSegredo(senha, user.senhaHash) : (await gastarTempoDeVerificacao(senha), false);

  // Conta desativada é tratada como credencial inválida (não revela que a conta existe).
  if (!user || !user.ativo || !senhaValida) {
    // Se o bloqueio anterior já venceu, a contagem recomeça do zero (senão uma falha renova o bloqueio para sempre).
    const baseIp = tentativa?.bloqueadoAte && tentativa.bloqueadoAte <= agora ? 0 : (tentativa?.tentativas ?? 0);
    const baseGlobal = global?.bloqueadoAte && global.bloqueadoAte <= agora ? 0 : (global?.tentativas ?? 0);
    const novasTentativas = baseIp + 1;
    const novasGlobais = baseGlobal + 1;
    const bloqueio = new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000);
    await prisma.loginAttempt.upsert({
      where: { identificador: chaveIp },
      create: { identificador: chaveIp, tentativas: 1 },
      update: { tentativas: novasTentativas, bloqueadoAte: novasTentativas >= MAX_TENTATIVAS ? bloqueio : null },
    });
    await prisma.loginAttempt.upsert({
      where: { identificador: chave },
      create: { identificador: chave, tentativas: 1 },
      update: { tentativas: novasGlobais, bloqueadoAte: novasGlobais >= TETO_GLOBAL ? bloqueio : null },
    });
    return { ok: false, erro: 'Usuário/e-mail ou senha inválidos.' };
  }

  await prisma.loginAttempt.deleteMany({ where: { identificador: { in: [chaveIp, chave] } } });
  // Registra o último acesso (a tela de Usuários mostra). Falha aqui não pode impedir o login.
  await prisma.user.update({ where: { id: user.id }, data: { ultimoLoginEm: agora } }).catch(() => undefined);
  const { token, expiresAt } = await criarSessao(user.id);
  return { ok: true, token, expiresAt };
}
