-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN IF NOT EXISTS "observacaoPortaria" TEXT;

-- AlterTable
ALTER TABLE "ChegadaCaminhao" ADD COLUMN IF NOT EXISTS "observacao" TEXT;
