-- Áreas de estoque (Almoxarifado, Sala de Metrologia e Materiais, Sala de Óleo), com materiais e histórico de movimentos.
CREATE TABLE IF NOT EXISTS "EstoqueArea" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "EstoqueArea_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EstoqueMaterial" (
  "id" TEXT NOT NULL,
  "areaId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "unidade" TEXT NOT NULL,
  "fabricante" TEXT,
  "quantidade" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EstoqueMaterial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EstoqueMaterial_areaId_idx" ON "EstoqueMaterial"("areaId");

CREATE TABLE IF NOT EXISTS "EstoqueMovimento" (
  "id" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "quantidade" DECIMAL(12,3) NOT NULL,
  "saldoApos" DECIMAL(12,3) NOT NULL,
  "motivo" TEXT,
  "documento" TEXT,
  "responsavel" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EstoqueMovimento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EstoqueMovimento_materialId_criadoEm_idx" ON "EstoqueMovimento"("materialId", "criadoEm");

DO $$ BEGIN
  ALTER TABLE "EstoqueMaterial" ADD CONSTRAINT "EstoqueMaterial_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "EstoqueArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EstoqueMovimento" ADD CONSTRAINT "EstoqueMovimento_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "EstoqueMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO "EstoqueArea" ("id", "nome", "ordem") VALUES
  ('area-almoxarifado', 'Almoxarifado', 1),
  ('area-metrologia', 'Sala de Metrologia e Materiais', 2),
  ('area-oleo', 'Sala de Óleo', 3)
ON CONFLICT ("id") DO NOTHING;
