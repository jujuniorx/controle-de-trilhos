-- Estoque de trilhos automático: forma do novo (lisa ou tala) no grupo, saldo inicial e ajustes,
-- cargas de TLS do trilheiro e valores do SAP para conferência.
CREATE TYPE "FormaNovo" AS ENUM ('LISA', 'TALA');

ALTER TABLE "Grupo" ADD COLUMN "formaNovo" "FormaNovo";

CREATE TABLE "EstoqueTrilhoLancamento" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "secao" TEXT NOT NULL,
    "perfil" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fabricante" TEXT,
    "classe" TEXT NOT NULL,
    "metros" DECIMAL(14,3) NOT NULL,
    "unidades" INTEGER,
    "origemTipo" TEXT NOT NULL,
    "motivo" TEXT,
    "responsavel" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstoqueTrilhoLancamento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EstoqueTrilhoLancamento_origemTipo_idx" ON "EstoqueTrilhoLancamento"("origemTipo");

CREATE TABLE "TrilheiroCarga" (
    "id" TEXT NOT NULL,
    "trilheiro" "TrilheiroCod" NOT NULL,
    "boEm" DATE NOT NULL,
    "perfil" TEXT NOT NULL,
    "reemprego" BOOLEAN NOT NULL DEFAULT false,
    "fabricante" TEXT,
    "quantidade" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrilheiroCarga_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TrilheiroCarga_trilheiro_boEm_idx" ON "TrilheiroCarga"("trilheiro", "boEm");

CREATE TABLE "EstoqueSapValor" (
    "item" TEXT NOT NULL,
    "toneladas" DECIMAL(12,3) NOT NULL,
    "responsavel" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstoqueSapValor_pkey" PRIMARY KEY ("item")
);
