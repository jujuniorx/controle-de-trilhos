import { headers } from 'next/headers';

/**
 * Endereço de quem está fazendo a requisição, para o bloqueio por tentativa.
 * Na Vercel, o último valor de x-forwarded-for é o que a plataforma anotou; o primeiro pode ser
 * inventado pelo próprio cliente, então não é usado. Sem o cabeçalho, cai num valor fixo
 * (o bloqueio global continua valendo).
 */
export async function ipDoCliente(): Promise<string> {
  const cabecalhos = await headers();
  const encadeado = cabecalhos.get('x-forwarded-for');
  const ultimo = encadeado ? encadeado.split(',').map((p) => p.trim()).filter(Boolean).pop() : undefined;
  return (ultimo ?? cabecalhos.get('x-real-ip') ?? 'desconhecido').slice(0, 64);
}
