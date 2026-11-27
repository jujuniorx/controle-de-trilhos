-- Remetido de vagão (B.O. do trilheiro) lançado pelo Administrativo: trilheiro, valor da NF,
-- opção de não mexer no estoque, grupos de TLS e os vagões do B.O.
ALTER TABLE "Movimentacao" ADD COLUMN "trilheiro" "TrilheiroCod";
ALTER TABLE "Movimentacao" ADD COLUMN "valorNf" DECIMAL(14,2);
ALTER TABLE "Movimentacao" ADD COLUMN "movimentaEstoque" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Grupo" ADD COLUMN "tls" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "VagaoRemetido" (
    "id" TEXT NOT NULL,
    "movimentacaoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "serie" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "pesoLiquido" DECIMAL(10,2),
    "pesoBruto" DECIMAL(10,2),

    CONSTRAINT "VagaoRemetido_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VagaoRemetido_movimentacaoId_idx" ON "VagaoRemetido"("movimentacaoId");
ALTER TABLE "VagaoRemetido" ADD CONSTRAINT "VagaoRemetido_movimentacaoId_fkey" FOREIGN KEY ("movimentacaoId") REFERENCES "Movimentacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
