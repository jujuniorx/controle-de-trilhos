-- Estoque completo: Trilhos passa a ser uma área como as outras (entrada, baixa, ajuste e histórico)
-- e cada material ganha os campos das telas novas. Pode rodar mais de uma vez.

ALTER TABLE "EstoqueMaterial"
  -- Todas as áreas: abaixo disso o item fica amarelo e entra em "Precisa de atenção".
  ADD COLUMN IF NOT EXISTS "minimo" DECIMAL(12,3),
  -- Almoxarifado: prateleira ("Corte e desbaste") e posição ("A-01"). Metrologia: "Instrumentos de medição" ou "Ferramentas".
  ADD COLUMN IF NOT EXISTS "grupo" TEXT,
  ADD COLUMN IF NOT EXISTS "endereco" TEXT,
  -- Trilhos: PERFIL (saldo em metros), TALA (pares) ou LISA (barras). O peso sai da tabela FatorPerfil.
  ADD COLUMN IF NOT EXISTS "categoria" TEXT,
  ADD COLUMN IF NOT EXISTS "perfil" "PerfilTrilho",
  ADD COLUMN IF NOT EXISTS "furos" INTEGER,
  ADD COLUMN IF NOT EXISTS "comprimentoBarra" DECIMAL(6,2),
  -- Metrologia: última calibração e até quando vale.
  ADD COLUMN IF NOT EXISTS "calibradoEm" DATE,
  ADD COLUMN IF NOT EXISTS "calibracaoValidade" DATE,
  -- Sala de Óleo: quanto cabe guardado (para o nível do tambor) e em quê ("2 tambores", "balde").
  ADD COLUMN IF NOT EXISTS "capacidade" DECIMAL(12,3),
  ADD COLUMN IF NOT EXISTS "embalagem" TEXT;

CREATE INDEX IF NOT EXISTS "EstoqueMaterial_calibracaoValidade_idx" ON "EstoqueMaterial"("calibracaoValidade");

-- Trilhos como área do estoque, antes das outras.
INSERT INTO "EstoqueArea" ("id", "nome", "ordem") VALUES ('area-trilhos', 'Trilhos', 0)
ON CONFLICT ("id") DO NOTHING;
