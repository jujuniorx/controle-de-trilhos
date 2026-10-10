import crypto from 'crypto';

// TOTP (RFC 6238) com HMAC-SHA1, 6 dígitos, passo de 30 s — o padrão do Google Authenticator,
// Microsoft Authenticator, Authy etc. Implementado com o `crypto` do Node (sem dependência nova).

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let valor = 0;
  let saida = '';
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31];
  return saida;
}

export function base32Decode(texto: string): Buffer {
  const limpo = texto.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const ch of limpo) {
    const idx = ALFABETO.indexOf(ch);
    if (idx === -1) throw new Error('Segredo base32 inválido');
    valor = (valor << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function gerarSegredoTotp(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function passoAtual(agoraMs: number = Date.now()): number {
  return Math.floor(agoraMs / 1000 / 30);
}

export function codigoTotp(segredoBase32: string, passo: number, digitos = 6): string {
  const chave = base32Decode(segredoBase32);
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(passo));
  const h = crypto.createHmac('sha1', chave).update(contador).digest();
  const off = h[h.length - 1] & 0xf;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digitos).padStart(digitos, '0');
}

function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/**
 * Confere o código informado (aceita 1 passo para trás/frente, por diferença de relógio).
 * Devolve o passo que bateu, ou null. `ultimoPasso` impede reutilizar o mesmo código.
 */
export function verificarTotp(
  segredoBase32: string,
  codigo: string,
  opcoes: { agoraMs?: number; janela?: number; ultimoPasso?: number | null } = {},
): number | null {
  const limpo = codigo.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(limpo)) return null;
  const { agoraMs = Date.now(), janela = 1, ultimoPasso = null } = opcoes;
  const base = passoAtual(agoraMs);
  let achado: number | null = null;
  for (let d = -janela; d <= janela; d++) {
    const passo = base + d;
    if (iguais(codigoTotp(segredoBase32, passo), limpo)) achado = passo;
  }
  if (achado === null) return null;
  if (ultimoPasso !== null && achado <= ultimoPasso) return null;
  return achado;
}

export function otpauthUri(segredoBase32: string, conta: string, emissor = 'Controle de Trilhos'): string {
  const rotulo = encodeURIComponent(`${emissor}:${conta}`);
  return `otpauth://totp/${rotulo}?secret=${segredoBase32}&issuer=${encodeURIComponent(emissor)}&algorithm=SHA1&digits=6&period=30`;
}
