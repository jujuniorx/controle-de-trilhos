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

-- Traz para o cadastro os motoristas que já estão nos envios e nas chegadas salvos.
-- Para cada motorista vale o dado do registro mais recente; os veículos vêm de todos os registros.
CREATE TEMP TABLE envios_tmp AS
SELECT btrim("motoristaNome") AS nome, "motoristaCpf" AS cpf, "motoristaTelefone" AS telefone, "transportadora",
       "placaCavalo", "placaCarreta", "placaCarreta2", "capacidadeCarga", "comprimentoCarreta",
       COALESCE("dataMovimentacao"::timestamp, now()) AS quando
FROM "Movimentacao"
WHERE btrim(COALESCE("motoristaNome", '')) <> ''
UNION ALL
SELECT btrim("motoristaNome"), "motoristaCpf", "motoristaTelefone", "transportadora",
       "placaCavalo", "placaCarreta", "placaCarreta2", "capacidadeCarga", "comprimentoCarreta",
       "criadoEm"
FROM "ChegadaCaminhao"
WHERE btrim(COALESCE("motoristaNome", '')) <> '';

INSERT INTO "MotoristaCadastro" (id, nome, cpf, telefone, transportadora, "atualizadoEm")
SELECT gen_random_uuid()::text, u.nome, NULLIF(u.cpf, ''), NULLIF(u.telefone, ''), NULLIF(u."transportadora", ''), now()
FROM (SELECT DISTINCT ON (nome) * FROM envios_tmp ORDER BY nome, quando DESC) u
ON CONFLICT ("nome") DO NOTHING;

INSERT INTO "VeiculoMotorista" (id, "motoristaId", "placaCavalo", "placaCarreta", "placaCarreta2", "capacidadeCarga", "comprimentoCarreta", "ultimoUsoEm")
SELECT gen_random_uuid()::text, m.id, v."placaCavalo", v."placaCarreta", v."placaCarreta2", v."capacidadeCarga", v."comprimentoCarreta", v.quando
FROM (SELECT DISTINCT ON (nome, "placaCavalo", "placaCarreta", "placaCarreta2") *
      FROM envios_tmp
      WHERE COALESCE("placaCavalo", "placaCarreta", "placaCarreta2") IS NOT NULL
      ORDER BY nome, "placaCavalo", "placaCarreta", "placaCarreta2", quando DESC) v
JOIN "MotoristaCadastro" m ON m.nome = v.nome;

DROP TABLE envios_tmp;
