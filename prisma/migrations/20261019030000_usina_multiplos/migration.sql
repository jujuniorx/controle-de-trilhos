-- Trilheiros: um giro pode ter vários perfis (o campo antigo "perfil" é mantido).
ALTER TABLE "TrilheiroGiro" ADD COLUMN IF NOT EXISTS "perfis" "TipoTls"[] DEFAULT ARRAY[]::"TipoTls"[];
UPDATE "TrilheiroGiro" SET "perfis" = ARRAY["perfil"] WHERE "perfil" IS NOT NULL AND cardinality("perfis") = 0;

-- Geração: carretas por dia (várias por líder), com perfis múltiplos.
CREATE TABLE IF NOT EXISTS "GeracaoCarreta" (
    "id" TEXT NOT NULL,
    "geracaoDiaId" TEXT NOT NULL,
    "perfis" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quantidade" INTEGER,
    "carregamentoM" DECIMAL(65,30),
    "deixadaViaM" DECIMAL(65,30),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeracaoCarreta_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GeracaoCarreta_geracaoDiaId_idx" ON "GeracaoCarreta"("geracaoDiaId");

DO $$ BEGIN
  ALTER TABLE "GeracaoCarreta" ADD CONSTRAINT "GeracaoCarreta_geracaoDiaId_fkey"
    FOREIGN KEY ("geracaoDiaId") REFERENCES "GeracaoDia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Copia o que já estava lançado na linha do dia para a primeira carreta (nada se perde).
INSERT INTO "GeracaoCarreta" ("id", "geracaoDiaId", "perfis", "quantidade", "carregamentoM", "deixadaViaM", "ordem", "criadoEm")
SELECT
  'mig_' || md5("id"),
  "id",
  CASE WHEN "perfil" IS NULL OR "perfil" = '' THEN ARRAY[]::TEXT[] ELSE ARRAY["perfil"] END,
  "quantidade",
  "carregamentoM",
  "deixadaViaM",
  0,
  CURRENT_TIMESTAMP
FROM "GeracaoDia"
WHERE ("quantidade" IS NOT NULL OR "carregamentoM" IS NOT NULL OR "deixadaViaM" IS NOT NULL OR ("perfil" IS NOT NULL AND "perfil" <> ''))
  AND NOT EXISTS (SELECT 1 FROM "GeracaoCarreta" c WHERE c."geracaoDiaId" = "GeracaoDia"."id");
