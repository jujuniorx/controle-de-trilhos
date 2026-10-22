-- Carga e descarga: data e quem confirmou o carregamento.
ALTER TABLE "ChegadaCaminhao" ADD COLUMN IF NOT EXISTS "cargaCarregadaEm" TIMESTAMP(3);
ALTER TABLE "ChegadaCaminhao" ADD COLUMN IF NOT EXISTS "cargaCarregadaPor" TEXT;
