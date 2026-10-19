-- Carga e descarga: data/quem confirmou o carregamento e a medição da carga (metros).
ALTER TABLE "ChegadaCaminhao" ADD COLUMN IF NOT EXISTS "cargaCarregadaEm" TIMESTAMP(3);
ALTER TABLE "ChegadaCaminhao" ADD COLUMN IF NOT EXISTS "cargaCarregadaPor" TEXT;
ALTER TABLE "ChegadaCaminhao" ADD COLUMN IF NOT EXISTS "cargaMedidaM" DECIMAL(65,30);
