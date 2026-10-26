-- Observação de cada setor da usina, uma por dia (justifica a produção do dia no relatório diário).
CREATE TABLE IF NOT EXISTS "ObservacaoSetorDia" (
  "id" TEXT NOT NULL,
  "data" DATE NOT NULL,
  "setor" TEXT NOT NULL,
  "texto" TEXT,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ObservacaoSetorDia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ObservacaoSetorDia_data_setor_key" ON "ObservacaoSetorDia"("data", "setor");
