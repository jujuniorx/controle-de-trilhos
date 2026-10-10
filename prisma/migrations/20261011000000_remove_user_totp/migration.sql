-- Remove as colunas da verificação em duas etapas (recurso descartado).
ALTER TABLE "User" DROP COLUMN IF EXISTS "totpSecret", DROP COLUMN IF EXISTS "totpAtivo", DROP COLUMN IF EXISTS "totpUltimoPasso";
