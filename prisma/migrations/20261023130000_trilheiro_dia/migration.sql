-- CreateTable
CREATE TABLE "TrilheiroDia" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "trilheiro" "TrilheiroCod" NOT NULL,
    "boEm" DATE,
    "descarregadas" INTEGER,
    "programacao" TEXT,
    "observacao" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrilheiroDia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrilheiroDia_data_trilheiro_key" ON "TrilheiroDia"("data", "trilheiro");
