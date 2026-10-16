-- AlterTable
ALTER TABLE "ChegadaCaminhao" ADD COLUMN IF NOT EXISTS "descarregadaEm" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "descarregadaPor" TEXT;
