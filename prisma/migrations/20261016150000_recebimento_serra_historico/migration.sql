-- CreateTable
CREATE TABLE IF NOT EXISTS "RecebimentoSerraHistorico" (
    "id" TEXT NOT NULL,
    "sheet" TEXT NOT NULL,
    "linha" INTEGER NOT NULL,
    "nf" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "cidade" TEXT NOT NULL,
    "placa" TEXT,
    "descricao" TEXT,
    "pecas" INTEGER,
    "pesoT" DECIMAL(65,30),
    "metrosTotal" DECIMAL(65,30),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecebimentoSerraHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RecebimentoSerraHistorico_sheet_linha_key" ON "RecebimentoSerraHistorico"("sheet", "linha");
CREATE INDEX IF NOT EXISTS "RecebimentoSerraHistorico_nf_idx" ON "RecebimentoSerraHistorico"("nf");
CREATE INDEX IF NOT EXISTS "RecebimentoSerraHistorico_cidade_idx" ON "RecebimentoSerraHistorico"("cidade");
