-- AlterTable
ALTER TABLE "ChegadaCaminhao" ADD COLUMN IF NOT EXISTS "cargaDescarga" BOOLEAN NOT NULL DEFAULT false;
