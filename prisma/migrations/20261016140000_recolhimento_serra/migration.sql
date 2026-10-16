-- CreateTable
CREATE TABLE IF NOT EXISTS "RecolhimentoSerra" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "cidade" TEXT NOT NULL,
    "trecho" TEXT,
    "unidades" INTEGER NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecolhimentoSerra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RecolhimentoSerra_cidade_data_idx" ON "RecolhimentoSerra"("cidade", "data");
