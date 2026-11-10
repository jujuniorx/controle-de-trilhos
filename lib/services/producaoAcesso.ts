import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { verificarSegredo } from '@/lib/services/auth';

// Mesmo lockout do Pátio: 5 tentativas por aparelho, bloqueio de 15 minutos, teto global de 30.
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;
const TETO_GLOBAL = 30;
const IDENTIFICADOR = 'PRODUCAO_PIN';

export const COOKIE_PRODUCAO = 'acesso_producao';

/** Cookie assinado com o próprio hash do PIN: trocar o PIN invalida as sessões antigas. */
function assinatura(hash: string): string {
  return crypto.createHmac('sha256', hash).update('producao-ok').digest('hex');
}

export function cookieProducaoValido(valor: string | undefined): boolean {
  const hash = process.env.PRODUCAO_PIN_HASH;
  if (!hash || !valor) return false;
  const esperado = Buffer.from(assinatura(hash));
  const recebido = Buffer.from(valor);
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);
}

export function valorCookieProducao(): string | null {
  const hash = process.env.PRODUCAO_PIN_HASH;
  return hash ? assinatura(hash) : null;
}

export interface ResultadoPinProducao {
  ok: boolean;
  erro?: string;
}

export async function verificarPinProducaoComBloqueio(pin: string, ip = 'desconhecido'): Promise<ResultadoPinProducao> {
  const hash = process.env.PRODUCAO_PIN_HASH;
  if (!hash) return { ok: false, erro: 'Acesso da Produção não configurado. Avise o escritório.' };

  const chave = `${IDENTIFICADOR}@${ip}`;
  const [tentativa, global] = await Promise.all([
    prisma.loginAttempt.findUnique({ where: { identificador: chave } }),
    prisma.loginAttempt.findUnique({ where: { identificador: IDENTIFICADOR } }),
  ]);
  const agora = new Date();
  if ((tentativa?.bloqueadoAte && tentativa.bloqueadoAte > agora) || (global?.bloqueadoAte && global.bloqueadoAte > agora)) {
    return { ok: false, erro: 'Código bloqueado temporariamente. Tente novamente mais tarde.' };
  }

  const valido = await verificarSegredo(pin.trim(), hash);
  if (!valido) {
    const bloqueio = new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000);
    const novoIp = (tentativa?.bloqueadoAte && tentativa.bloqueadoAte <= agora ? 0 : (tentativa?.tentativas ?? 0)) + 1;
    const novoGlobal = (global?.bloqueadoAte && global.bloqueadoAte <= agora ? 0 : (global?.tentativas ?? 0)) + 1;
    await prisma.loginAttempt.upsert({
      where: { identificador: chave },
      create: { identificador: chave, tentativas: 1 },
      update: { tentativas: novoIp, bloqueadoAte: novoIp >= MAX_TENTATIVAS ? bloqueio : null },
    });
    await prisma.loginAttempt.upsert({
      where: { identificador: IDENTIFICADOR },
      create: { identificador: IDENTIFICADOR, tentativas: 1 },
      update: { tentativas: novoGlobal, bloqueadoAte: novoGlobal >= TETO_GLOBAL ? bloqueio : null },
    });
    return { ok: false, erro: 'Código inválido.' };
  }

  await prisma.loginAttempt.deleteMany({ where: { identificador: { in: [chave, IDENTIFICADOR] } } });
  return { ok: true };
}
