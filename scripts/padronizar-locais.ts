// Padroniza origem e destino já gravados (ex.: "Ponta grossa" e "Ponta Grossa" -> "PONTA GROSSA").
//
// Desde a padronização (lib/domain/local.ts) tudo que é gravado novo já sai em MAIÚSCULAS e sem
// espaços sobrando. Registros ANTIGOS continuam com a grafia original no banco (as telas, o
// romaneio, o Excel e os gráficos já mostram padronizado) — este script grava o mesmo padrão
// neles. Variações que só diferem por acento ("MARINGA" e "MARINGÁ") ficam na grafia acentuada.
//
// Uso:
//   npx tsx scripts/padronizar-locais.ts            # só LISTA (não grava nada)
//   npx tsx scripts/padronizar-locais.ts --aplicar  # grava a padronização
//
// Rode primeiro sem --aplicar e confira a lista. Faça backup/branch do banco antes.
import { prisma } from '../lib/db';
import { chaveLocal, normalizarLocal } from '../lib/domain/local';

async function main() {
  const aplicar = process.argv.includes('--aplicar');

  const movs = await prisma.movimentacao.findMany({
    select: { id: true, origem: true, destino: true },
    orderBy: { id: 'asc' },
  });

  // chave (sem acento) -> grafias padronizadas encontradas, com quantas vezes aparecem.
  const variantesPorChave = new Map<string, Map<string, number>>();
  for (const m of movs) {
    for (const valor of [m.origem, m.destino]) {
      const padronizado = normalizarLocal(valor);
      if (!padronizado) continue;
      const chave = chaveLocal(valor);
      const variantes = variantesPorChave.get(chave) ?? new Map<string, number>();
      variantes.set(padronizado, (variantes.get(padronizado) ?? 0) + 1);
      variantesPorChave.set(chave, variantes);
    }
  }

  // Grafia final de cada local: prefere a acentuada; entre iguais, a mais usada.
  const finalPorChave = new Map<string, string>();
  for (const [chave, variantes] of variantesPorChave) {
    const ordenadas = [...variantes.entries()].sort(
      (a, b) => Number(b[0] !== chave) - Number(a[0] !== chave) || b[1] - a[1],
    );
    const melhor = ordenadas[0];
    if (melhor) finalPorChave.set(chave, melhor[0]);
  }

  const padronizar = (valor: string | null): string | null => {
    if (valor == null) return null;
    const chave = chaveLocal(valor);
    if (!chave) return valor;
    return finalPorChave.get(chave) ?? normalizarLocal(valor);
  };

  const mudancas: Array<{ id: string; dados: { origem?: string; destino?: string } }> = [];
  for (const m of movs) {
    const dados: { origem?: string; destino?: string } = {};
    const origem = padronizar(m.origem);
    const destino = padronizar(m.destino);
    if (origem != null && origem !== m.origem) dados.origem = origem;
    if (destino != null && destino !== m.destino) dados.destino = destino;
    if (dados.origem !== undefined || dados.destino !== undefined) {
      mudancas.push({ id: m.id, dados });
      if (dados.origem !== undefined) console.log(`  ${m.id} origem:  "${m.origem}" -> "${dados.origem}"`);
      if (dados.destino !== undefined) console.log(`  ${m.id} destino: "${m.destino}" -> "${dados.destino}"`);
    }
  }

  console.log(`\nMovimentações analisadas: ${movs.length}`);
  console.log(`Movimentações que mudariam: ${mudancas.length}`);

  if (!aplicar) {
    console.log('\nModo lista: nada foi gravado. Use --aplicar para padronizar.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const mudanca of mudancas) {
      await tx.movimentacao.update({ where: { id: mudanca.id }, data: mudanca.dados });
    }
  });
  console.log('\nPadronização aplicada.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
