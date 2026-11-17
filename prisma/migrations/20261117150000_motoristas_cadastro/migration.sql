-- Cadastro de motoristas da Portaria e os veículos que cada um já usou.
CREATE TABLE "MotoristaCadastro" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "telefone" TEXT,
    "transportadora" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MotoristaCadastro_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MotoristaCadastro_nome_key" ON "MotoristaCadastro"("nome");

CREATE TABLE "VeiculoMotorista" (
    "id" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "placaCavalo" TEXT,
    "placaCarreta" TEXT,
    "placaCarreta2" TEXT,
    "capacidadeCarga" DECIMAL(65,30),
    "comprimentoCarreta" DECIMAL(65,30),
    "ultimoUsoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VeiculoMotorista_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VeiculoMotorista_motoristaId_placaCavalo_placaCarreta_placaCarreta2_key" ON "VeiculoMotorista"("motoristaId", "placaCavalo", "placaCarreta", "placaCarreta2");

ALTER TABLE "VeiculoMotorista" ADD CONSTRAINT "VeiculoMotorista_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "MotoristaCadastro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
