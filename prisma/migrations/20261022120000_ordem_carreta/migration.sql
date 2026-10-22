-- Número de ordem da carreta no dia (Portaria)
ALTER TABLE "Movimentacao" ADD COLUMN IF NOT EXISTS "ordemDia" INTEGER, ADD COLUMN IF NOT EXISTS "ordemData" TEXT;
