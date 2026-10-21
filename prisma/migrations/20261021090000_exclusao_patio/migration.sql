-- Pátio pode excluir chegadas e recebimentos pendentes (vão para a lixeira, com motivo).
ALTER TABLE "ChegadaCaminhao" ADD COLUMN IF NOT EXISTS "excluidaEm" TIMESTAMP(3);
ALTER TABLE "ChegadaCaminhao" ADD COLUMN IF NOT EXISTS "excluidaPor" TEXT;
ALTER TABLE "ChegadaCaminhao" ADD COLUMN IF NOT EXISTS "excluidaMotivo" TEXT;
ALTER TABLE "MovimentacaoExcluida" ADD COLUMN IF NOT EXISTS "motivo" TEXT;
