import type { PerfilTrilho } from '@prisma/client';
import { prisma } from '../lib/db';
import { hashSegredo } from '../lib/services/auth';

// Fatores oficiais confirmados pelo usuário para todos os 11 perfis.
const FATORES_CONFIRMADOS: Partial<Record<PerfilTrilho, number>> = {
  TR22: 0.022,
  TR32: 0.032,
  TR37: 0.037,
  TR40: 0.04,
  TR45: 0.045,
  TR50: 0.05,
  TR54: 0.054,
  TR55: 0.055,
  TR57: 0.057,
  TR60: 0.06,
  TR68: 0.068,
};

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA_INICIAL;
  if (!email || !senha) throw new Error('ADMIN_EMAIL e ADMIN_SENHA_INICIAL são obrigatórios');

  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    console.log('Usuário admin já existe, nada a fazer.');
    return;
  }

  await prisma.user.create({ data: { nome: 'Junior', email, senhaHash: await hashSegredo(senha) } });
  console.log(`Usuário admin criado: ${email}`);
}

async function seedFatoresPerfil() {
  const entradas = Object.entries(FATORES_CONFIRMADOS) as [PerfilTrilho, number][];
  for (const [perfil, fator] of entradas) {
    await prisma.fatorPerfil.upsert({
      where: { perfil },
      create: { perfil, fator },
      update: { fator },
    });
  }
  console.log(`Fatores de perfil confirmados: ${entradas.map(([perfil]) => perfil).join(', ')}`);
}

async function main() {
  await seedFatoresPerfil();
  await seedAdmin();
}

main().finally(() => prisma.$disconnect());
