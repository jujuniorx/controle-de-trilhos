-- Observação diária do estaleiro de solda.
ALTER TABLE "EstaleiroDia" ADD COLUMN IF NOT EXISTS "observacao" TEXT;
