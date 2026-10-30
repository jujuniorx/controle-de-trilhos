-- CreateTable
CREATE TABLE "EstoqueItem" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "fabricante" TEXT,
    "quantidadeT" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "quantidadeM" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstoqueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EstoqueItem_tipo_idx" ON "EstoqueItem"("tipo");
