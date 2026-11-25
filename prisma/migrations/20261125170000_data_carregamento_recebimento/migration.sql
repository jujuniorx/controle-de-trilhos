-- Recebimento: data de carregamento (quando a carga saiu da origem). Registros antigos ficam NULL,
-- e o relatório mostra "Não informada" para eles.
ALTER TABLE "Movimentacao" ADD COLUMN "dataCarregamento" TIMESTAMP(3);
