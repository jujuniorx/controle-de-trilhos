// Cria as contas do Administrativo por usuário/senha (Bloco 3) — não há
// autocadastro público de propósito; criação de conta só por aqui.
//
// Uso: `npx tsx scripts/criar-usuarios-administrativos.ts`
import { prisma } from '../lib/db';
import { randomBytes } from 'crypto';
import { hashSegredo } from '../lib/services/auth';

// Senha inicial sorteada e mostrada uma única vez no terminal. Nunca fica escrita no código.
const CONTAS = [
  { nome: 'Paula', username: 'paula' },
  { nome: 'Priscila', username: 'priscila' },
  { nome: 'Marcelo', username: 'marcelo' },
  { nome: 'Bianca', username: 'bianca' },
] as const;

async function main() {
  for (const conta of CONTAS) {
    const existente = await prisma.user.findUnique({ where: { username: conta.username } });
    if (existente) {
      console.log(`Usuário "${conta.username}" já existe, nada a fazer.`);
      continue;
    }

    const senhaSorteada = randomBytes(9).toString("base64url") + "A1";
    await prisma.user.create({
      data: {
        nome: conta.nome,
        // E-mail é @unique e obrigatório no schema — cada conta por usuário ganha
        // um e-mail interno só para satisfazer essa constraint; o login de verdade
        // é pelo username.
        email: `${conta.username}@controle-trilhos.local`,
        username: conta.username,
        senhaHash: await hashSegredo(senhaSorteada),
      },
    });
    console.log(`Usuário "${conta.username}" criado. Senha inicial (anote e troque no primeiro acesso): ${senhaSorteada}`);
  }
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
