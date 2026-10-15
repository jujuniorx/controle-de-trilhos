-- AlterTable
ALTER TABLE "Movimentacao"
  ADD COLUMN IF NOT EXISTS "motoristaNome" TEXT,
  ADD COLUMN IF NOT EXISTS "motoristaCpf" TEXT,
  ADD COLUMN IF NOT EXISTS "motoristaTelefone" TEXT,
  ADD COLUMN IF NOT EXISTS "capacidadeCarga" DECIMAL(65,30),
  ADD COLUMN IF NOT EXISTS "materialPrevisto" TEXT,
  ADD COLUMN IF NOT EXISTS "medicaoConcluidaEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "carretaLiberadaEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "carretaLiberadaPor" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
