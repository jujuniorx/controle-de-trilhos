-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN IF NOT EXISTS "numerosDocumentoExtras" TEXT[] DEFAULT ARRAY[]::TEXT[];
