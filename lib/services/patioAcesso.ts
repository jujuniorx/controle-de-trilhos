import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { verificarSegredo } from '@/lib/services/auth';

// Mesmos parâmetros de lockout usados em lib/services/loginService.ts, para
// consistência entre os dois fluxos de autenticação da aplicação.
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

// O PIN do Pátio é um segredo único compartilhado (não por usuário), então o
// LoginAttempt correspondente usa um identificador fixo em vez de um e-mail.
const PIN_IDENTIFICADOR = 'PATIO_PIN';

export interface ResultadoVerificacaoPin {
  ok: boolean;
  erro?: string;
}

export async function verificarPin(pinInformado: string): Promise<boolean> {
  const hashConfigurado = process.env.PATIO_PIN_HASH;
  if (!hashConfigurado) throw new Error('PATIO_PIN_HASH não configurado');
  return verificarSegredo(pinInformado, hashConfigurado);
}

/**
 * Verifica o PIN do Pátio com proteção contra força bruta, reaproveitando o
 * modelo LoginAttempt (mesmo mecanismo de lockout de autenticar() em
 * loginService.ts: 5 tentativas / bloqueio de 15 minutos, limpo no sucesso).
 * Deve ser o ponto de entrada usado pela Server Action de acesso do Pátio —
 * verificarPin() sozinho não tem proteção contra força bruta.
 */
export async function verificarPinComBloqueio(pinInformado: string): Promise<ResultadoVerificacaoPin> {
  const tentativa = await prisma.loginAttempt.findUnique({ where: { identificador: PIN_IDENTIFICADOR } });
  if (tentativa?.bloqueadoAte && tentativa.bloqueadoAte > new Date()) {
    return { ok: false, erro: 'Código bloqueado temporariamente. Tente novamente mais tarde.' };
  }

  const valido = await verificarPin(pinInformado);

  if (!valido) {
    const novasTentativas = (tentativa?.tentativas ?? 0) + 1;
    await prisma.loginAttempt.upsert({
      where: { identificador: PIN_IDENTIFICADOR },
      create: { identificador: PIN_IDENTIFICADOR, tentativas: 1 },
      update: {
        tentativas: novasTentativas,
        bloqueadoAte: novasTentativas >= MAX_TENTATIVAS ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000) : null,
      },
    });
    return { ok: false, erro: 'Código inválido.' };
  }

  await prisma.loginAttempt.deleteMany({ where: { identificador: PIN_IDENTIFICADOR } });
  return { ok: true };
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
