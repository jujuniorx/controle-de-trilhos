// Cria as contas do Administrativo por usuário/senha (Bloco 3) — não há
// autocadastro público de propósito; criação de conta só por aqui.
//
// Uso: `npx tsx scripts/criar-usuarios-administrativos.ts`
import { prisma } from '../lib/db';
import { hashSegredo } from '../lib/services/auth';

const CONTAS = [
  { nome: 'Paula', username: 'paula', senha: 'Paula2026!' },
  { nome: 'Priscila', username: 'priscila', senha: 'Priscila2026!' },
  { nome: 'Marcelo', username: 'marcelo', senha: 'Marcelo2026!' },
  { nome: 'Bianca', username: 'bianca', senha: 'Bianca2026!' },
] as const;

async function main() {
  for (const conta of CONTAS) {
    const existente = await prisma.user.findUnique({ where: { username: conta.username } });
    if (existente) {
      console.log(`Usuário "${conta.username}" já existe, nada a fazer.`);
      continue;
    }

    await prisma.user.create({
      data: {
        nome: conta.nome,
        // E-mail é @unique e obrigatório no schema — cada conta por usuário ganha
        // um e-mail interno só para satisfazer essa constraint; o login de verdade
        // é pelo username.
        email: `${conta.username}@controle-trilhos.local`,
        username: conta.username,
        senhaHash: await hashSegredo(conta.senha),
      },
    });
    console.log(`Usuário "${conta.username}" criado.`);
  }
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
