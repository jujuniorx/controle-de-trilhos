import { prisma } from '@/lib/db';

/**
 * Limite de requisições por computador numa janela de tempo (ex.: 60 por minuto).
 * Usa a tabela LoginAttempt com chave por janela; linhas antigas são apagadas de vez em quando.
 * Se o banco falhar, deixa passar: o limite não pode derrubar o sistema.
 */
export async function dentroDoLimite(nome: string, maximo: number, janelaMs: number, ip: string): Promise<boolean> {
  try {
    const janela = Math.floor(Date.now() / janelaMs);
    const chave = `taxa:${nome}:${ip}:${janela}`;
    const registro = await prisma.loginAttempt.upsert({
      where: { identificador: chave },
      create: { identificador: chave, tentativas: 1 },
      update: { tentativas: { increment: 1 } },
    });
    if (Math.random() < 0.01) {
      await prisma.loginAttempt.deleteMany({
        where: { identificador: { startsWith: 'taxa:' }, atualizadoEm: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });
    }
    return registro.tentativas <= maximo;
  } catch {
    return true;
  }
}
