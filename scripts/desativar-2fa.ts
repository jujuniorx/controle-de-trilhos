// Desativa a verificação em duas etapas de um usuário (ex.: perdeu o celular).
// Uso: npx tsx scripts/desativar-2fa.ts <usuario-ou-email>
// Rode com DATABASE_URL apontando para o banco certo (produção, se for o caso).
import { prisma } from '../lib/db';

async function main() {
  const alvo = (process.argv[2] ?? '').trim().toLowerCase();
  if (!alvo) {
    console.error('Informe o usuário ou e-mail. Ex.: npx tsx scripts/desativar-2fa.ts paula');
    process.exitCode = 1;
    return;
  }
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: { equals: alvo, mode: 'insensitive' } }, { username: { equals: alvo, mode: 'insensitive' } }] },
  });
  if (!user) {
    console.error(`Usuário não encontrado: ${alvo}`);
    process.exitCode = 1;
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { totpAtivo: false, totpSecret: null, totpUltimoPasso: null } });
  console.log(`2FA desativado para ${user.nome} (${user.email}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
