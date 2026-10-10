// Renomeia a conta "Administrador" para "Junior" e libera o login pelo usuário "junior".
// A senha e o e-mail NÃO mudam (quem entra hoje pelo e-mail continua entrando).
//
// Uso: `npx tsx scripts/renomear-admin.ts`  (com DATABASE_URL apontando para o banco desejado)
import { prisma } from '../lib/db';

async function main() {
  const conta = await prisma.user.findFirst({ where: { nome: 'Administrador' } });
  if (!conta) {
    console.log('Nenhuma conta chamada "Administrador" encontrada, nada a fazer.');
    return;
  }
  const ocupado = await prisma.user.findUnique({ where: { username: 'junior' } });
  const dados: { nome: string; username?: string } = { nome: 'Junior' };
  if (!ocupado) dados.username = 'junior';
  await prisma.user.update({ where: { id: conta.id }, data: dados });
  console.log(
    `Conta ${conta.email} agora se chama "Junior"` +
      (dados.username ? ' e entra pelo usuário "junior".' : ' (usuário "junior" já existia; login por e-mail mantido).'),
  );
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
