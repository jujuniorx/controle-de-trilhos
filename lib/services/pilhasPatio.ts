import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';

/**
 * Lista das pilhas do pátio: nome da pilha e o que tem nela (perfil ou tipo).
 * Tabela criada na primeira chamada (CREATE TABLE IF NOT EXISTS), sem depender de migrate deploy.
 * Temporária: pode ser removida depois que o levantamento for concluído.
 */

import { MATERIAIS_VALIDOS_PILHA, type DadosPilhaPatio, type PilhaPatio } from '@/lib/domain/pilhasPatio';

export { OPCOES_MATERIAL_PILHA } from '@/lib/domain/pilhasPatio';
export type { DadosPilhaPatio, PilhaPatio } from '@/lib/domain/pilhasPatio';

let tabelaPronta: Promise<void> | null = null;

function garantirTabela(): Promise<void> {
  if (!tabelaPronta) {
    tabelaPronta = prisma
      .$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "PilhaPatio" (
          "id" TEXT PRIMARY KEY,
          "nome" TEXT NOT NULL DEFAULT '',
          "material" TEXT NOT NULL DEFAULT '',
          "observacao" TEXT NOT NULL DEFAULT '',
          "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
      )
      .then(() => undefined)
      .catch((e) => {
        tabelaPronta = null;
        throw e;
      });
  }
  return tabelaPronta;
}

type LinhaBanco = {
  id: string;
  nome: string;
  material: string;
  observacao: string;
  atualizadoEm: Date;
};

export async function listarPilhasPatio(): Promise<PilhaPatio[]> {
  await garantirTabela();
  const linhas = await prisma.$queryRaw<LinhaBanco[]>`
    SELECT "id", "nome", "material", "observacao", "atualizadoEm"
    FROM "PilhaPatio"
    ORDER BY "criadoEm" ASC
  `;
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    material: l.material,
    observacao: l.observacao,
    atualizadoEm: new Date(l.atualizadoEm).toISOString(),
  }));
}

export async function criarPilhaPatio(): Promise<PilhaPatio> {
  await garantirTabela();
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "PilhaPatio" ("id", "nome", "material", "observacao")
    VALUES (${id}, '', '', '')
  `;
  return { id, nome: '', material: '', observacao: '', atualizadoEm: new Date().toISOString() };
}

function validarDados(d: DadosPilhaPatio): string | null {
  if (d.nome.length > 60) return 'O nome da pilha pode ter até 60 caracteres.';
  if (d.observacao.length > 120) return 'A observação pode ter até 120 caracteres.';
  if (d.material && !MATERIAIS_VALIDOS_PILHA.has(d.material)) return 'Escolha o material da lista.';
  return null;
}

export async function salvarPilhaPatio(id: string, dados: DadosPilhaPatio): Promise<void> {
  const erro = validarDados(dados);
  if (erro) throw new Error(erro);
  await garantirTabela();
  const nome = dados.nome.trim();
  const material = dados.material;
  const observacao = dados.observacao.trim();
  const alteradas = await prisma.$executeRaw`
    UPDATE "PilhaPatio"
    SET "nome" = ${nome}, "material" = ${material}, "observacao" = ${observacao}, "atualizadoEm" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
  `;
  if (alteradas === 0) throw new Error('Essa pilha não existe mais. Atualize a página.');
}

export async function removerPilhaPatio(id: string): Promise<void> {
  await garantirTabela();
  await prisma.$executeRaw`DELETE FROM "PilhaPatio" WHERE "id" = ${id}`;
}
