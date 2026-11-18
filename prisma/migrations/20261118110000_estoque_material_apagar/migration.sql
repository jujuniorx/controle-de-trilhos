-- Materiais apagados vão para a lixeira da área (podem ser restaurados).
ALTER TABLE "EstoqueMaterial" ADD COLUMN IF NOT EXISTS "excluidoEm" TIMESTAMP(3);
