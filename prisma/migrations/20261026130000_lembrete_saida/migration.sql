-- Lembretes à Portaria quando a carreta foi liberada pelo Pátio e a saída não foi registrada.
ALTER TABLE "Movimentacao" ADD COLUMN IF NOT EXISTS "lembretesSaidaEnviados" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Movimentacao" ADD COLUMN IF NOT EXISTS "ultimoLembreteSaidaEm" TIMESTAMP(3);
