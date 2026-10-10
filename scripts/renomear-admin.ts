// Renomeia a conta "Administrador" para "Junior", libera o login pelo usuário "junior" e a
// torna a conta DONO do sistema (gerencia usuários, exclui movimentações, vê a auditoria).
// A senha e o e-mail NÃO mudam. Pode rodar mais de uma vez.
//
// Pré-requisito: o deploy com as migrações novas já ter sido feito (a Vercel aplica no build).
// Uso: `npx tsx scripts/renomear-admin.ts`  (com DATABASE_URL apontando para o banco desejado)
import { prisma } from '../lib/db';

async function main() {
  const conta =
    (await prisma.user.findFirst({ where: { nome: 'Administrador' } })) ??
    (await prisma.user.findUnique({ where: { username: 'junior' } }));
  if (!conta) {
    console.log('Nenhuma conta "Administrador" (ou "junior") encontrada, nada a fazer.');
    return;
  }
  const ocupado = conta.username ? null : await prisma.user.findUnique({ where: { username: 'junior' } });
  const dados: { nome: string; role: 'DONO'; username?: string } = { nome: 'Junior', role: 'DONO' };
  if (!conta.username && !ocupado) dados.username = 'junior';
  await prisma.user.update({ where: { id: conta.id }, data: dados });
  console.log(`Conta ${conta.email} agora é "Junior" (DONO), usuário: ${dados.username ?? conta.username ?? '(só e-mail)'}.`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
