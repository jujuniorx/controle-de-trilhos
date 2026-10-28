-- CreateEnum
CREATE TYPE "MalhaTls" AS ENUM ('PAULISTA', 'NORTE', 'FIPS');

-- CreateTable
CREATE TABLE "EstoqueTlsMalha" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoTls" NOT NULL,
    "malha" "MalhaTls" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstoqueTlsMalha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EstoqueTlsMalha_data_tipo_malha_key" ON "EstoqueTlsMalha"("data", "tipo", "malha");
