import crypto from 'crypto';

/**
 * Proteção do segredo de 2 etapas e do "passe" temporário entre a senha e o código.
 * A chave vem de TOTP_ENC_KEY (qualquer texto longo e aleatório, definido na Vercel).
 * Sem a variável, o 2FA não pode ser ativado (falha fechada).
 */
function chaveMestra(): Buffer {
  const k = process.env.TOTP_ENC_KEY;
  if (!k || k.length < 16) throw new Error('TOTP_ENC_KEY não configurada (mínimo 16 caracteres).');
  return crypto.createHash('sha256').update(k).digest();
}

export function doisFatoresDisponivel(): boolean {
  const k = process.env.TOTP_ENC_KEY;
  return !!k && k.length >= 16;
}

export function cifrar(texto: string): string {
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv('aes-256-gcm', chaveMestra(), iv);
  const dados = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
  return 'v1:' + Buffer.concat([iv, cifra.getAuthTag(), dados]).toString('base64');
}

export function decifrar(valor: string): string {
  if (!valor.startsWith('v1:')) throw new Error('Formato de segredo desconhecido');
  const buf = Buffer.from(valor.slice(3), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const dados = buf.subarray(28);
  const d = crypto.createDecipheriv('aes-256-gcm', chaveMestra(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString('utf8');
}

const VALIDADE_PASSE_MS = 5 * 60 * 1000;

function assinar(payload: string): string {
  const chave = crypto.createHash('sha256').update('passe2fa:').update(chaveMestra()).digest();
  return crypto.createHmac('sha256', chave).update(payload).digest('base64url');
}

/** Passe curto (5 min) emitido depois da senha correta; só serve para a tela do código. */
export function criarPasse2fa(userId: string, agoraMs: number = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, e: agoraMs + VALIDADE_PASSE_MS })).toString('base64url');
  return `${payload}.${assinar(payload)}`;
}

export function lerPasse2fa(passe: string | undefined, agoraMs: number = Date.now()): string | null {
  if (!passe) return null;
  const [payload, assinatura] = passe.split('.');
  if (!payload || !assinatura) return null;
  const esperado = assinar(payload);
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { u: string; e: number };
    return typeof u === 'string' && typeof e === 'number' && e > agoraMs ? u : null;
  } catch {
    return null;
  }
}
