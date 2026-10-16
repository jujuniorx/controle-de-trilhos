-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN IF NOT EXISTS "comprimentoCarreta" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "ChegadaCaminhao" ADD COLUMN IF NOT EXISTS "placaCarreta2" TEXT, ADD COLUMN IF NOT EXISTS "comprimentoCarreta" DECIMAL(65,30);
