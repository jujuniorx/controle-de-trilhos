-- CreateTable
CREATE TABLE "EstoqueBarraCurtaMalha" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoTls" NOT NULL,
    "malha" "MalhaTls" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstoqueBarraCurtaMalha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EstoqueBarraCurtaMalha_data_tipo_malha_key" ON "EstoqueBarraCurtaMalha"("data", "tipo", "malha");
