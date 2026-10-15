import { prisma } from '@/lib/db';

/**
 * Atualização do banco pela própria tela do dono ("Usuários"), para quando o `prisma migrate deploy`
 * não rodou no deploy. Aplica as MESMAS alterações das migrations recentes (prisma/migrations/2026101513*,
 * 2026101514*, e as duas de 2026101512*), todas escritas para poderem rodar mais de uma vez
 * (IF NOT EXISTS): rodar aqui e depois o migrate deploy não dá conflito. Um teste confere que esta
 * lista continua igual aos arquivos de migration.
 *
 * Só o dono aciona (ver app/admin/(protegido)/usuarios/actions.ts) e o SQL é fixo — nenhuma entrada
 * de usuário entra nele.
 */
export const COMANDOS_ESQUEMA: readonly string[] = [
  // 20261015120000_perfil_toco
  `ALTER TYPE "PerfilTrilho" ADD VALUE IF NOT EXISTS 'TOCO'`,
  // 20261015120100_lixeira_movimentacao
  `CREATE TABLE IF NOT EXISTS "MovimentacaoExcluida" ("id" TEXT NOT NULL, "movimentacaoId" TEXT NOT NULL, "tipo" "TipoMovimentacao" NOT NULL, "rotulo" TEXT NOT NULL, "dados" JSONB NOT NULL, "excluidoPorId" TEXT, "excluidoPorNome" TEXT NOT NULL, "excluidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "restauradoEm" TIMESTAMP(3), CONSTRAINT "MovimentacaoExcluida_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "MovimentacaoExcluida_excluidoEm_idx" ON "MovimentacaoExcluida"("excluidoEm")`,
  // 20261015130000_role_portaria
  `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PORTARIA'`,
  // 20261015130100_portaria
  `ALTER TABLE "Movimentacao" ADD COLUMN IF NOT EXISTS "motoristaNome" TEXT, ADD COLUMN IF NOT EXISTS "motoristaCpf" TEXT, ADD COLUMN IF NOT EXISTS "motoristaTelefone" TEXT, ADD COLUMN IF NOT EXISTS "capacidadeCarga" DECIMAL(65,30), ADD COLUMN IF NOT EXISTS "materialPrevisto" TEXT, ADD COLUMN IF NOT EXISTS "medicaoConcluidaEm" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "carretaLiberadaEm" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "carretaLiberadaPor" TEXT`,
  `CREATE TABLE IF NOT EXISTS "PushSubscription" ("id" TEXT NOT NULL, "endpoint" TEXT NOT NULL, "p256dh" TEXT NOT NULL, "auth" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint")`,
  // 20261015140000_chegada_caminhao
  `CREATE TABLE IF NOT EXISTS "ChegadaCaminhao" ("id" TEXT NOT NULL, "origem" TEXT, "materialPrevisto" TEXT, "transportadora" TEXT, "motoristaNome" TEXT, "motoristaCpf" TEXT, "motoristaTelefone" TEXT, "placaCarreta" TEXT, "placaCavalo" TEXT, "capacidadeCarga" DECIMAL(65,30), "criadoPor" TEXT NOT NULL, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "liberadaEm" TIMESTAMP(3), "liberadaPor" TEXT, "canceladaEm" TIMESTAMP(3), "movimentacaoId" TEXT, "recebidaEm" TIMESTAMP(3), CONSTRAINT "ChegadaCaminhao_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ChegadaCaminhao_movimentacaoId_key" ON "ChegadaCaminhao"("movimentacaoId")`,
  `CREATE INDEX IF NOT EXISTS "ChegadaCaminhao_criadoEm_idx" ON "ChegadaCaminhao"("criadoEm")`,
  // 20261015140100_observacao
  `ALTER TABLE "Movimentacao" ADD COLUMN IF NOT EXISTS "observacao" TEXT`,
];

/** Está faltando algo? Confere uma coluna e duas tabelas das migrations recentes. Nunca lança. */
export async function esquemaPrecisaAtualizar(): Promise<boolean> {
  try {
    const linhas = await prisma.$queryRaw<Array<{ ok: boolean }>>`
      SELECT (
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Movimentacao' AND column_name = 'observacao')
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Movimentacao' AND column_name = 'carretaLiberadaEm')
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ChegadaCaminhao')
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PushSubscription')
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'MovimentacaoExcluida')
        AND EXISTS (
          SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'Role' AND e.enumlabel = 'PORTARIA'
        )
      ) AS ok`;
    return !linhas[0]?.ok;
  } catch {
    return false; // não sabe dizer: não mostra o aviso
  }
}

/** Aplica os comandos, um por vez (ALTER TYPE ... ADD VALUE não roda dentro de transação). */
export async function atualizarEsquema(): Promise<number> {
  for (const comando of COMANDOS_ESQUEMA) {
    await prisma.$executeRawUnsafe(comando);
  }
  return COMANDOS_ESQUEMA.length;
}
