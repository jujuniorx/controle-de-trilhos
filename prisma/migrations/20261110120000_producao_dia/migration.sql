-- CreateTable
CREATE TABLE "ProducaoDia" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "soldadores" TEXT NOT NULL,
    "lider" TEXT NOT NULL,
    "perfil" TEXT NOT NULL,
    "fabricante" TEXT NOT NULL,
    "sobraEntrada" INTEGER NOT NULL DEFAULT 0,
    "totalSoldas" INTEGER NOT NULL DEFAULT 0,
    "tlsFormados" INTEGER NOT NULL DEFAULT 0,
    "sobraSaida" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProducaoDia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProducaoLinha" (
    "id" TEXT NOT NULL,
    "diaId" TEXT NOT NULL,
    "hora" TEXT NOT NULL,
    "soldas" INTEGER NOT NULL DEFAULT 0,
    "cortes" INTEGER NOT NULL DEFAULT 0,
    "justificativaCorte" TEXT,
    "paradaInicio" TEXT,
    "paradaMinutos" INTEGER,
    "paradaDescricao" TEXT,
    "perfil" TEXT NOT NULL,
    "fabricante" TEXT NOT NULL,

    CONSTRAINT "ProducaoLinha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProducaoDia_data_key" ON "ProducaoDia"("data");

-- CreateIndex
CREATE UNIQUE INDEX "ProducaoLinha_diaId_hora_key" ON "ProducaoLinha"("diaId", "hora");

-- AddForeignKey
ALTER TABLE "ProducaoLinha" ADD CONSTRAINT "ProducaoLinha_diaId_fkey" FOREIGN KEY ("diaId") REFERENCES "ProducaoDia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
