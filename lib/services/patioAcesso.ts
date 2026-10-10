import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { verificarSegredo } from '@/lib/services/auth';

// Mesmos parâmetros de lockout usados em lib/services/loginService.ts, para
// consistência entre os dois fluxos de autenticação da aplicação.
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

// O PIN do Pátio é um segredo único compartilhado (não por usuário), então o
// LoginAttempt correspondente usa um identificador fixo em vez de um e-mail.
const PIN_IDENTIFICADOR = 'PATIO_PIN';

const MSG_BANCO_INDISPONIVEL = 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.';

// Formato esperado de um hash Argon2id: $argon2id$v=19$m=...,t=...,p=...$salt$hash
// (os três parâmetros m/t/p não têm ordem fixa entre versões/plataformas do
// binding nativo — nesta instalação, por exemplo, sai "m=...,p=...,t=...",
// confirmado rodando argon2.hash() localmente; o padrão aceita as 6 permutações).
// Checagem puramente estrutural, não participa da decisão de autenticar — só
// de observabilidade. Existe porque verificarSegredo() falha fechado e nunca
// lança (por design, ver lib/services/auth.ts): um PATIO_PIN_HASH corrompido
// (ex.: truncado por interpolação de shell/template ao configurar a variável)
// produz exatamente o mesmo "Código inválido." que um PIN errado, sem nenhum
// outro sinal. Esta checagem torna esse caso visível nos logs, sem nunca
// registrar o valor do hash.
const FORMATO_ARGON2ID =
  /^\$argon2(id|i|d)\$v=\d+\$(?:m=\d+|t=\d+|p=\d+)(?:,(?:m=\d+|t=\d+|p=\d+)){2}\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;

export interface ResultadoVerificacaoPin {
  ok: boolean;
  erro?: string;
}

/**
 * Só os dois tipos de erro do Prisma que significam "não conseguimos nem
 * falar com o banco" (conexão recusada/indisponível, ou o engine travou) —
 * nunca PrismaClientKnownRequestError/ValidationError, que são bugs de
 * query/schema com o banco perfeitamente no ar e precisam continuar
 * explodindo alto para serem notados, não serem mascarados de "indisponível".
 */
function erroDeConexaoComBanco(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientInitializationError || erro instanceof Prisma.PrismaClientRustPanicError;
}

export async function verificarPin(pinInformado: string): Promise<boolean> {
  const hashConfigurado = process.env.PATIO_PIN_HASH;
  if (!hashConfigurado) throw new Error('PATIO_PIN_HASH não configurado');

  if (!FORMATO_ARGON2ID.test(hashConfigurado)) {
    console.error(
      '[patioAcesso] PATIO_PIN_HASH não tem o formato esperado de um hash Argon2id — provável corrupção da variável de ambiente (valor nunca registrado em log).',
    );
  }

  // Normaliza espaços nas pontas: o campo do formulário não impõe formato
  // (type="password", sem maxLength/pattern em app/patio/acesso/page.tsx), e
  // autofill ou teclados numéricos de alguns tablets podem introduzir espaço
  // invisível nas pontas. Comparar o valor bruto faria um PIN visualmente
  // correto ser rejeitado.
  return verificarSegredo(pinInformado.trim(), hashConfigurado);
}

/**
 * Verifica o PIN do Pátio com proteção contra força bruta, reaproveitando o
 * modelo LoginAttempt (mesmo mecanismo de lockout de autenticar() em
 * loginService.ts: 5 tentativas / bloqueio de 15 minutos, limpo no sucesso).
 * Deve ser o ponto de entrada usado pela Server Action de acesso do Pátio —
 * verificarPin() sozinho não tem proteção contra força bruta.
 */
export async function verificarPinComBloqueio(pinInformado: string): Promise<ResultadoVerificacaoPin> {
  let tentativa;
  try {
    tentativa = await prisma.loginAttempt.findUnique({ where: { identificador: PIN_IDENTIFICADOR } });
  } catch (erro) {
    if (!erroDeConexaoComBanco(erro)) throw erro;
    return { ok: false, erro: MSG_BANCO_INDISPONIVEL };
  }

  if (tentativa?.bloqueadoAte && tentativa.bloqueadoAte > new Date()) {
    return { ok: false, erro: 'Código bloqueado temporariamente. Tente novamente mais tarde.' };
  }

  // Puramente Argon2 contra a variável de ambiente — não toca o banco, então
  // nenhum catch de indisponibilidade é necessário aqui.
  const valido = await verificarPin(pinInformado);

  if (!valido) {
    // O PIN em si não bateu (não é falha de infraestrutura): registra a
    // tentativa normalmente. Se o próprio registro falhar por indisponibilidade
    // do banco, não dá para distinguir com segurança "PIN errado" de "não sei
    // dizer" — nega com a mensagem de indisponibilidade em vez de "Código
    // inválido.", para não contar silenciosamente um problema de infra como
    // tentativa incorreta nem deixar passar sem registrar no rate limiting.
    try {
      const novasTentativas = (tentativa?.tentativas ?? 0) + 1;
      await prisma.loginAttempt.upsert({
        where: { identificador: PIN_IDENTIFICADOR },
        create: { identificador: PIN_IDENTIFICADOR, tentativas: 1 },
        update: {
          tentativas: novasTentativas,
          bloqueadoAte: novasTentativas >= MAX_TENTATIVAS ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000) : null,
        },
      });
    } catch (erro) {
      if (!erroDeConexaoComBanco(erro)) throw erro;
      return { ok: false, erro: MSG_BANCO_INDISPONIVEL };
    }
    return { ok: false, erro: 'Código inválido.' };
  }

  // PIN certo, mas ainda falta limpar o contador de tentativas. Se o banco
  // cair bem aqui, nega o acesso mesmo assim (fail-safe) em vez de devolver
  // ok:true sem ter confirmado a limpeza — criarAcessoPatio() mais adiante
  // também depende do banco, então não haveria acesso de verdade de qualquer
  // forma, e negar aqui evita um ok:true que não se sustenta.
  try {
    await prisma.loginAttempt.deleteMany({ where: { identificador: PIN_IDENTIFICADOR } });
  } catch (erro) {
    if (!erroDeConexaoComBanco(erro)) throw erro;
    return { ok: false, erro: MSG_BANCO_INDISPONIVEL };
  }
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
