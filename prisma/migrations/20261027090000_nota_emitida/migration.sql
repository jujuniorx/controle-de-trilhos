-- Nota fiscal da carreta liberada pelo Pátio: confirmação de emissão e controle dos avisos (admin a cada 30 min, Pátio a cada 1 h).
ALTER TABLE "Movimentacao" ADD COLUMN IF NOT EXISTS "notaEmitidaEm" TIMESTAMP(3);
ALTER TABLE "Movimentacao" ADD COLUMN IF NOT EXISTS "notaEmitidaPor" TEXT;
ALTER TABLE "Movimentacao" ADD COLUMN IF NOT EXISTS "ultimoAvisoNotaAdminEm" TIMESTAMP(3);
ALTER TABLE "Movimentacao" ADD COLUMN IF NOT EXISTS "ultimoAvisoNotaPatioEm" TIMESTAMP(3);
