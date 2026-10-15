-- AlterTable
ALTER TABLE "Movimentacao"
  ADD COLUMN "motoristaNome" TEXT,
  ADD COLUMN "motoristaCpf" TEXT,
  ADD COLUMN "motoristaTelefone" TEXT,
  ADD COLUMN "capacidadeCarga" DECIMAL(65,30),
  ADD COLUMN "materialPrevisto" TEXT,
  ADD COLUMN "medicaoConcluidaEm" TIMESTAMP(3),
  ADD COLUMN "carretaLiberadaEm" TIMESTAMP(3),
  ADD COLUMN "carretaLiberadaPor" TEXT;

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
