-- Rascunho automatico da Producao (salvo enquanto preenche). Tabela nova, sem mexer nos dados existentes.
CREATE TABLE "RascunhoProducao" (
    "data" TEXT NOT NULL,
    "campos" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RascunhoProducao_pkey" PRIMARY KEY ("data")
);
