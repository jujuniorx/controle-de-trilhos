import { prisma } from '../lib/db';
import { hashSegredo } from '../lib/services/auth';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA_INICIAL;
  if (!email || !senha) throw new Error('ADMIN_EMAIL e ADMIN_SENHA_INICIAL são obrigatórios');

  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    console.log('Usuário admin já existe, nada a fazer.');
    return;
  }

  await prisma.user.create({ data: { nome: 'Administrador', email, senhaHash: await hashSegredo(senha) } });
  console.log(`Usuário admin criado: ${email}`);
}

main().finally(() => prisma.$disconnect());
