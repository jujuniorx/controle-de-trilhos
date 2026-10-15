-- CreateTable
CREATE TABLE IF NOT EXISTS "ChegadaCaminhao" (
    "id" TEXT NOT NULL,
    "origem" TEXT,
    "materialPrevisto" TEXT,
    "transportadora" TEXT,
    "motoristaNome" TEXT,
    "motoristaCpf" TEXT,
    "motoristaTelefone" TEXT,
    "placaCarreta" TEXT,
    "placaCavalo" TEXT,
    "capacidadeCarga" DECIMAL(65,30),
    "criadoPor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liberadaEm" TIMESTAMP(3),
    "liberadaPor" TEXT,
    "canceladaEm" TIMESTAMP(3),
    "movimentacaoId" TEXT,
    "recebidaEm" TIMESTAMP(3),
    CONSTRAINT "ChegadaCaminhao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ChegadaCaminhao_movimentacaoId_key" ON "ChegadaCaminhao"("movimentacaoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChegadaCaminhao_criadoEm_idx" ON "ChegadaCaminhao"("criadoEm");
