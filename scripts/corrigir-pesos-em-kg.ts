// Corrige pesos digitados em kg em vez de toneladas (ex.: 31180 em vez de 31,18).
//
// O peso é SEMPRE em toneladas. Antes do limite de 100 t por grupo, o painel do
// Administrativo aceitava qualquer número, e o peso da NF (em kg) foi gravado como
// se fossem toneladas. Este script acha esses valores (> PESO_MAX_GRUPO_T) e,
// com --aplicar, divide por 1000.
//
// Uso:
//   npx tsx scripts/corrigir-pesos-em-kg.ts            # só LISTA (não grava nada)
//   npx tsx scripts/corrigir-pesos-em-kg.ts --aplicar  # grava a correção
//
// Rode primeiro sem --aplicar e confira a lista. Faça backup/branch do banco antes.
import { prisma } from '../lib/db';
import { PESO_MAX_GRUPO_T } from '../lib/validation/remetido';

async function main() {
  const aplicar = process.argv.includes('--aplicar');

  const grupos = await prisma.grupo.findMany({
    where: { pesoInformado: { gt: PESO_MAX_GRUPO_T } },
    include: { movimentacao: true },
    orderBy: { id: 'asc' },
  });
  const sucatas = await prisma.movimentacao.findMany({
    where: { pesoSucataReal: { gt: PESO_MAX_GRUPO_T } },
    orderBy: { id: 'asc' },
  });

  console.log(`Limite considerado: ${PESO_MAX_GRUPO_T} t por grupo.`);
  console.log(`\nGrupos com pesoInformado suspeito: ${grupos.length}`);
  for (const g of grupos) {
    const antes = Number(g.pesoInformado);
    console.log(
      `  grupo ${g.id} (movimentação ${g.movimentacaoId}, ${g.movimentacao.tipo}): ${antes} -> ${antes / 1000} t`,
    );
  }
  console.log(`\nMovimentações com pesoSucataReal suspeito: ${sucatas.length}`);
  for (const m of sucatas) {
    const antes = Number(m.pesoSucataReal);
    console.log(`  movimentação ${m.id}: ${antes} -> ${antes / 1000} t`);
  }

  if (!aplicar) {
    console.log('\nModo lista: nada foi gravado. Use --aplicar para corrigir.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const g of grupos) {
      await tx.grupo.update({ where: { id: g.id }, data: { pesoInformado: Number(g.pesoInformado) / 1000 } });
    }
    for (const m of sucatas) {
      await tx.movimentacao.update({ where: { id: m.id }, data: { pesoSucataReal: Number(m.pesoSucataReal) / 1000 } });
    }
  });
  console.log('\nCorreção aplicada.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
