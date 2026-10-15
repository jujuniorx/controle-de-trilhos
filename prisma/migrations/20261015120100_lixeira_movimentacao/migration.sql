-- CreateTable
CREATE TABLE IF NOT EXISTS "MovimentacaoExcluida" (
    "id" TEXT NOT NULL,
    "movimentacaoId" TEXT NOT NULL,
    "tipo" "TipoMovimentacao" NOT NULL,
    "rotulo" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "excluidoPorId" TEXT,
    "excluidoPorNome" TEXT NOT NULL,
    "excluidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restauradoEm" TIMESTAMP(3),

    CONSTRAINT "MovimentacaoExcluida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MovimentacaoExcluida_excluidoEm_idx" ON "MovimentacaoExcluida"("excluidoEm");
